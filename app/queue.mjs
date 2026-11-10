/* 排期 → 作业 → 出站发送。

   这一层原来是审计里最危险的地方，几个缺陷叠在一起：
   - 入队只看 content.status 是不是 'draft'，'pending_review' 的内容照样能发（PUB-01 门禁缺失）
   - 「认领」和「建作业」是两条独立 SQL，中间崩溃就永久卡住一条排期
   - 发送前不再检查审核状态，入队后有人把内容改回草稿/驳回也照发
   - 发布失败一律 +1 attempt，限流等待也算一次失败，3 次限流就把一条好内容判死
   - 只要不是「pending_*」，一律走重试；网络超时（远端可能已经建了帖）也重试 → 重复发布

   现在的口径：
   1) 入队前过 gate；发送前再过一次 gate（内容可能已经变了）
   2) 认领 + 建作业在同一个 BEGIN IMMEDIATE 事务里，要么都成要么都不成
   3) schedule.intent_id 是本次发送的意图号，作业带着它；重复/僵尸作业认不上 intent 就自我了断
   4) 限流等待不消耗 attempt
   5) 结果未知（已发出但没拿到确定答复）→ 不重试，转人工核对
*/

import { randomUUID } from 'node:crypto';
import { all, get, run, setting, audit, nowIso, today, tx } from './db.mjs';
import { channelFor, PublishError } from './channels.mjs';
import { RESULT_UNKNOWN_CLASS } from './errors.mjs';
import { checkPublishable } from './gate.mjs';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 120000;        // 作业租约：拿住后 2 分钟内必须动过，否则视为执行进程已死
const CLAIM_STALE_MS = 300000;  // 排期认领后 5 分钟没有对应作业，视为认领失败留下的孤儿

function limiter(platform) {
  const lim = get('select * from platform_limit where platform = ?', platform) || { min_interval_sec: 30, daily_cap: 20, cooldown_after_fail: 300 };
  let st = get('select * from rate_state where platform = ?', platform);
  if (!st) {
    run("insert into rate_state(platform, day, count, last_at, cooldown_until) values (?, ?, 0, '', '')", platform, today());
    st = get('select * from rate_state where platform = ?', platform);
  }
  const now = Date.now();
  if (st.cooldown_until && Date.parse(st.cooldown_until.replace(' ', 'T') + 'Z') > now) {
    return { ok: false, reason: `冷却中，直到 ${st.cooldown_until}` };
  }
  if (st.day !== today()) {
    run('update rate_state set day = ?, count = 0 where platform = ?', today(), platform);
    st.count = 0;
  }
  if (st.count >= lim.daily_cap) return { ok: false, reason: `今日配额已满（${lim.daily_cap}）` };
  if (st.last_at) {
    const last = Date.parse(st.last_at.replace(' ', 'T') + 'Z');
    if (now - last < lim.min_interval_sec * 1000) {
      return { ok: false, reason: `间隔限制 ${lim.min_interval_sec}s` };
    }
  }
  return { ok: true, lim };
}

function markSent(platform) {
  const st = get('select * from rate_state where platform = ?', platform);
  const count = (st?.count || 0) + 1;
  run('update rate_state set count = ?, last_at = ? where platform = ?', count, nowIso(), platform);
}

function markFailCooldown(platform) {
  const lim = get('select * from platform_limit where platform = ?', platform);
  const secs = lim?.cooldown_after_fail || 300;
  const until = new Date(Date.now() + secs * 1000).toISOString().replace('T', ' ').slice(0, 19);
  run('update rate_state set cooldown_until = ? where platform = ?', until, platform);
}

function plusSeconds(sec) {
  return new Date(Date.now() + sec * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function resolveChannel(schedule, platform) {
  const name = schedule.channel === 'auto' ? setting('publish_channel_default') : schedule.channel;
  return channelFor(name, platform);
}

/* 门禁不通过时排期该落到哪个终态：内容层面的问题等人改内容，配置层面的问题等人改配置。 */
function terminalForCode(code) {
  if (code === 'content_rejected' || code === 'content_missing') return 'failed';
  return 'blocked';
}

export function enqueueDueSchedules() {
  const now = nowIso();
  const due = all("select * from schedule where state = 'pending' and run_at <= ? order by run_at asc limit 20", now);
  for (const s of due) {
    const content = get('select * from content where id = ?', s.content_id);
    const account = get('select * from account where id = ?', s.account_id);
    if (!content || !account) {
      run("update schedule set state = 'failed', delivery_state = 'failed', last_error = '内容或账号已删除' where id = ?", s.id);
      continue;
    }

    const ch = resolveChannel(s, account.platform);
    // 发布前门禁：审核版本绑定、内容状态、账号状态、平台一致、integration 绑定、排期版本
    const gate = checkPublishable({ content, account, schedule: s, requireIntegration: ch.key === 'postiz' });
    if (!gate.ok) {
      const state = terminalForCode(gate.code);
      run('update schedule set state = ?, delivery_state = ?, last_error = ? where id = ?',
        state, state === 'failed' ? 'failed' : 'awaiting-user', gate.reason.slice(0, 500), s.id);
      audit('publish.gate', `schedule:${s.id}`, { code: gate.code, content: content.id });
      continue;
    }

    const intentId = randomUUID();
    // 认领 + 建作业必须原子：分两步做的话，中间崩溃会让这条排期永远停在 queued 而没有任何作业
    const claimed = tx(() => {
      const r = run(
        "update schedule set state = 'queued', delivery_state = 'pending', intent_id = ?, claimed_at = ?, last_error = '' where id = ? and state = 'pending'",
        intentId, now, s.id
      );
      if (!r || !r.changes) return false;
      run("insert into job(kind, payload, state, run_at, intent_id) values ('publish', ?, 'queued', ?, ?)",
        JSON.stringify({ schedule_id: s.id, intent_id: intentId }), now, intentId);
      return true;
    });
    if (!claimed) continue;   // 别人已经领走了
  }
  return due.length;
}

/* 发送前的二次门禁：入队之后内容可能又被改回草稿、或被驳回、或账号被停用。 */
function recheckSchedule(s) {
  const content = get('select * from content where id = ?', s.content_id);
  const account = get('select * from account where id = ?', s.account_id);
  if (!content || !account) return { ok: false, code: 'content_missing', reason: '内容或账号已删除', content, account };
  const ch = resolveChannel(s, account.platform);
  const gate = checkPublishable({ content, account, schedule: s, requireIntegration: ch.key === 'postiz' });
  return { ...gate, content, account, ch };
}

function recordResult({ s, content, account, platform, channel, ok, errorClass, detail, postizPostId, platformPostId, publicUrl, deliveryState }) {
  run(
    `insert into publish_result(schedule_id, content_id, account_id, platform, channel, ok, error_class, detail,
       platform_post_id, postiz_post_id, delivery_state)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id, content.id, account.id, platform, channel, ok ? 1 : 0, errorClass || '', (detail || '').slice(0, 800),
    platformPostId || '', postizPostId || '', deliveryState || ''
  );
}

export async function runJob(job) {
  const leaseUntil = plusSeconds(LEASE_MS / 1000);
  // 认领：只有 queued/retry 才能被拿；顺手给 schedule 打上「正在发」的标记
  const grabbed = tx(() => {
    const r = run("update job set state = 'running', lease_until = ?, updated_at = ? where id = ? and state in ('queued','retry')",
      leaseUntil, nowIso(), job.id);
    return !!(r && r.changes);
  });
  if (!grabbed) return;   // 另一个 worker 已经拿走，或者已经终结

  const payload = JSON.parse(job.payload || '{}');
  const s = get('select * from schedule where id = ?', payload.schedule_id);
  if (!s) {
    run("update job set state = 'done', last_error = '排期已不存在', updated_at = ? where id = ?", nowIso(), job.id);
    return;
  }
  // intent 对不上：这是上一次认领留下的僵尸作业，不能拿它去发当前这条排期
  if (payload.intent_id && s.intent_id && payload.intent_id !== s.intent_id) {
    run("update job set state = 'done', last_error = '作业已过期（排期意图号已变更）', updated_at = ? where id = ?", nowIso(), job.id);
    return;
  }
  // 排期已经被别处终结（人工取消 / 已发出 / 已失败），作业不能再动手
  if (!['queued', 'retrying'].includes(String(s.state))) {
    run("update job set state = 'done', last_error = ?, updated_at = ? where id = ?", `排期状态是 ${s.state}，不再发送`, nowIso(), job.id);
    return;
  }

  const pre = recheckSchedule(s);
  const content = pre.content;
  const account = pre.account;
  const platform = account?.platform || '';
  const ch = pre.ch || resolveChannel(s, platform);

  if (!pre.ok) {
    const state = terminalForCode(pre.code);
    recordResult({
      s, content: content || { id: s.content_id }, account: account || { id: s.account_id }, platform, channel: ch.key,
      ok: false, errorClass: pre.code, detail: pre.reason,
      deliveryState: state === 'failed' ? 'failed' : 'awaiting-user',
    });
    run("update job set state = 'blocked', last_error = ?, updated_at = ? where id = ?", pre.reason.slice(0, 500), nowIso(), job.id);
    run('update schedule set state = ?, delivery_state = ?, last_error = ? where id = ?',
      state, state === 'failed' ? 'failed' : 'awaiting-user', pre.reason.slice(0, 500), s.id);
    audit('publish.gate', `schedule:${s.id}`, { code: pre.code, stage: 'pre-send' });
    return;
  }

  // 限流：只是等，不是失败。attempt 不加，作业退回队列，30 秒后再看。
  const lim = limiter(platform);
  if (!lim.ok) {
    run("update job set state = 'queued', run_at = ?, last_error = ?, lease_until = '', updated_at = ? where id = ?",
      plusSeconds(30), lim.reason, nowIso(), job.id);
    run("update schedule set state = 'queued', delivery_state = 'pending', last_error = ? where id = ?", lim.reason, s.id);
    return;
  }

  run("update schedule set delivery_state = 'sending', sending_at = ? where id = ?", nowIso(), s.id);

  try {
    const r = await ch.publish({ content, account, platform, schedule: s, mode: s.publish_mode });
    // 适配器必须显式回 ok:true 才算发出去
    if (!r || r.ok !== true) {
      throw new PublishError('upstream_error',
        `通道 ${ch.key} 未确认发布成功（返回里没有 ok:true）`,
        JSON.stringify(r ?? null).slice(0, 300), { dispatched: ch.key !== 'mock', outcomeKnown: false });
    }
    // Postiz 回的 id 是它自己的建帖任务号；Mastodon/Bluesky/Telegram/webhook 是直发，回的就是平台 id
    const isPostiz = ch.key === 'postiz';
    const postizPostId = isPostiz ? String(r.postiz_post_id || r.post_id || '') : '';
    const anyId = postizPostId || String(r.post_id || '');
    if (!anyId && ch.key !== 'mock') {
      // 远端回了 2xx 但没给 id：帖子可能已经建了，不许重发
      throw new PublishError(RESULT_UNKNOWN_CLASS,
        `通道 ${ch.key} 没回 post id，无法确认这条真的发出去了`,
        JSON.stringify(r).slice(0, 300), { dispatched: true, outcomeKnown: false });
    }
    // PUB-03：draft 只是躺进 integration 的草稿箱，不能记成「已发布」
    const deliveryState = String(r.delivery_state || (s.publish_mode === 'draft' ? 'draft' : 'submitted'));
    const isDraft = deliveryState === 'draft';
    const platformPostId = String(r.platform_post_id || (isPostiz ? '' : r.post_id || ''));
    const publicUrl = String(r.public_url || r.url || '');

    recordResult({
      s, content, account, platform, channel: ch.key, ok: true,
      postizPostId, platformPostId, publicUrl, deliveryState,
      detail: isDraft ? '已存为草稿（未发布）' : '',
    });
    run("update schedule set state = ?, delivery_state = ?, platform_post_id = ?, postiz_post_id = ?, public_url = ?, remote_state = ?, last_error = '' where id = ?",
      isDraft ? 'submitted' : 'published', deliveryState, platformPostId, postizPostId, publicUrl, deliveryState, s.id);
    // 草稿不动内容状态：内容仍然是「已通过」，等着真正发布，否则统计里会凭空多出一条已发
    if (!isDraft) run("update content set status = 'published' where id = ?", content.id);
    run("update job set state = 'done', attempts = attempts + 1, lease_until = '', updated_at = ? where id = ?", nowIso(), job.id);
    markSent(platform);
    audit('publish.ok', `content:${content.id}`, { channel: ch.key, platform, postiz_post_id: postizPostId, delivery_state: deliveryState });
  } catch (e) {
    const cls = e instanceof PublishError ? e.errorClass : 'exception';
    const unknown = cls === RESULT_UNKNOWN_CLASS || (e instanceof PublishError && e.dispatched && !e.outcomeKnown);
    const detail = [e.message, e.detail].filter(Boolean).join(' :: ').slice(0, 800);

    if (unknown) {
      // 结果未知：帖子可能已经在平台上，重发就是重复发布。停在 unknown 等人工核对。
      recordResult({ s, content, account, platform, channel: ch.key, ok: false, errorClass: RESULT_UNKNOWN_CLASS, detail, deliveryState: 'unknown' });
      run("update job set state = 'failed', last_error = ?, lease_until = '', updated_at = ? where id = ?",
        ('结果未知，需人工核对：' + e.message).slice(0, 500), nowIso(), job.id);
      run("update schedule set state = 'failed', delivery_state = 'unknown', last_error = ? where id = ?",
        ('结果未知，需人工核对：' + e.message).slice(0, 500), s.id);
      audit('publish.unknown', `content:${content.id}`, { channel: ch.key, error: e.message });
      return;
    }

    const attempts = (job.attempts || 0) + 1;
    recordResult({ s, content, account, platform, channel: ch.key, ok: false, errorClass: cls, detail, deliveryState: 'failed' });

    if (cls === 'pending_integration' || cls === 'pending_config' || cls === 'pending_media' || cls === 'auth_failed') {
      run("update job set state = 'blocked', attempts = ?, last_error = ?, lease_until = '', updated_at = ? where id = ?", attempts, e.message.slice(0, 500), nowIso(), job.id);
      run("update schedule set state = 'blocked', delivery_state = 'awaiting-user', retry = ?, last_error = ? where id = ?", attempts, e.message.slice(0, 500), s.id);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      run("update job set state = 'failed', attempts = ?, last_error = ?, lease_until = '', updated_at = ? where id = ?", attempts, e.message.slice(0, 500), nowIso(), job.id);
      run("update schedule set state = 'failed', delivery_state = 'failed', retry = ?, last_error = ? where id = ?", attempts, e.message.slice(0, 500), s.id);
      markFailCooldown(platform);
      audit('publish.fail', `content:${content.id}`, { error: e.message, class: cls });
    } else {
      const next = plusSeconds(60 * attempts);
      run("update job set state = 'retry', attempts = ?, run_at = ?, last_error = ?, lease_until = '', updated_at = ? where id = ?", attempts, next, e.message.slice(0, 500), nowIso(), job.id);
      run("update schedule set state = 'retrying', delivery_state = 'pending', retry = ?, last_error = ? where id = ?", attempts, e.message.slice(0, 500), s.id);
    }
  }
}

/* 崩溃恢复：
   - running 且租约过期的作业 → 结果未知（进程在发送中途死了，远端到底建没建帖无从得知），绝不重发
   - queued 认领超时但没有对应作业的排期 → 退回 pending（孤儿认领，什么都没发出去，退回安全） */
export function recoverStale() {
  let recovered = 0;
  const stale = all("select * from job where state = 'running' and (lease_until = '' or lease_until < ?) limit 20", nowIso());
  for (const j of stale) {
    let payload = {};
    try { payload = JSON.parse(j.payload || '{}'); } catch {}
    const s = payload.schedule_id ? get('select * from schedule where id = ?', payload.schedule_id) : null;
    const detail = '执行进程中断，发送结果未知（未自动重发，需人工到平台核对）';
    if (s && String(s.delivery_state) === 'sending') {
      recordResult({
        s, content: { id: s.content_id }, account: { id: s.account_id }, platform: s.platform || '',
        channel: s.channel || '', ok: false, errorClass: RESULT_UNKNOWN_CLASS, detail, deliveryState: 'unknown',
      });
      run("update schedule set state = 'failed', delivery_state = 'unknown', last_error = ? where id = ?", detail, s.id);
      audit('publish.unknown', `schedule:${s.id}`, { reason: 'lease_expired_mid_send' });
    } else if (s && ['queued', 'retrying'].includes(String(s.state))) {
      run("update schedule set state = 'pending', delivery_state = 'pending' where id = ?", s.id);
    }
    run("update job set state = 'failed', last_error = ?, lease_until = '', updated_at = ? where id = ?", detail, nowIso(), j.id);
    recovered += 1;
  }

  const cutoff = plusSeconds(-CLAIM_STALE_MS / 1000);
  const orphans = all(
    "select * from schedule where state = 'queued' and claimed_at != '' and claimed_at < ? limit 20", cutoff
  );
  for (const s of orphans) {
    const j = get("select * from job where intent_id = ? and state in ('queued','running','retry') limit 1", s.intent_id || '');
    if (j) continue;
    run("update schedule set state = 'pending', delivery_state = 'pending', claimed_at = '', intent_id = '' where id = ?", s.id);
    recovered += 1;
  }
  return recovered;
}

export async function tick() {
  if (setting('worker_enabled') !== '1') return { skipped: true };
  recoverStale();
  enqueueDueSchedules();
  const job = get("select * from job where state in ('queued','retry') and run_at <= ? order by id asc limit 1", nowIso());
  if (job) await runJob(job);
  return { ran: !!job };
}
