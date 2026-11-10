import { all, get, run, setting, audit, nowIso, today } from './db.mjs';
import { channelFor, PublishError } from './channels.mjs';

const MAX_ATTEMPTS = 3;

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

export function enqueueDueSchedules() {
  const now = nowIso();
  const due = all("select * from schedule where state = 'pending' and run_at <= ? order by run_at asc limit 20", now);
  for (const s of due) {
    const content = get('select * from content where id = ?', s.content_id);
    const account = get('select * from account where id = ?', s.account_id);
    if (!content || !account) {
      run("update schedule set state = 'failed', last_error = '内容或账号已删除' where id = ?", s.id);
      continue;
    }
    if (content.status === 'rejected') {
      run("update schedule set state = 'failed', last_error = '内容被驳回' where id = ?", s.id);
      continue;
    }
    if (content.status === 'draft') {
      run("update schedule set state = 'blocked', last_error = '内容未通过审核，暂不发布' where id = ?", s.id);
      continue;
    }
    const claimed = run("update schedule set state = 'queued' where id = ? and state = 'pending'", s.id);
    if (!claimed || !claimed.changes) continue;   // 别人已经领走了
    const payload = { schedule_id: s.id };
    run("insert into job(kind, payload, state, run_at) values ('publish', ?, 'queued', ?)", JSON.stringify(payload), now);
  }
  return due.length;
}

async function runJob(job) {
  const grabbed = run("update job set state = 'running' where id = ? and state in ('queued','retry')", job.id);
  if (!grabbed || !grabbed.changes) return;   // 另一个 worker 已经拿走
  const payload = JSON.parse(job.payload || '{}');
  const s = get('select * from schedule where id = ?', payload.schedule_id);
  if (!s) {
    run("update job set state = 'done', last_error = '排期已不存在' where id = ?", job.id);
    return;
  }
  const content = get('select * from content where id = ?', s.content_id);
  const account = get('select * from account where id = ?', s.account_id);
  if (!content || !account) {
    run("update job set state = 'failed', last_error = '内容或账号缺失' where id = ?", job.id);
    run("update schedule set state = 'failed' where id = ?", s.id);
    return;
  }
  const platform = account.platform;
  const ch = channelFor(s.channel === 'auto' ? setting('publish_channel_default') : s.channel, platform);

  const lim = limiter(platform);
  if (!lim.ok) {
    run("update job set state = 'retry', run_at = ?, last_error = ? where id = ?", new Date(Date.now() + 30000).toISOString().replace('T', ' ').slice(0, 19), lim.reason, job.id);
    return;
  }

  try {
    const r = await ch.publish({ content, account, platform, schedule: s });
    // 适配器必须显式回 ok:true 才算发出去。以前这里写死 ok=1，任何"看起来没抛异常"的返回都被记成成功。
    if (!r || r.ok !== true) {
      throw new PublishError('upstream_error',
        `通道 ${ch.key} 未确认发布成功（返回里没有 ok:true）`,
        JSON.stringify(r ?? null).slice(0, 300));
    }
    if (!r.post_id && ch.key !== 'mock') {
      throw new PublishError('upstream_error',
        `通道 ${ch.key} 没回平台 post id，无法确认这条真的发出去了`,
        JSON.stringify(r).slice(0, 300));
    }
    run(
      'insert into publish_result(schedule_id, content_id, account_id, platform, channel, ok, platform_post_id, url) values (?, ?, ?, ?, ?, 1, ?, ?)',
      s.id, content.id, account.id, platform, ch.key, r.post_id || '', r.url || ''
    );
    run("update schedule set state = 'published', last_error = '' where id = ?", s.id);
    run("update content set status = 'published' where id = ?", content.id);
    run("update job set state = 'done', attempts = attempts + 1, updated_at = ? where id = ?", nowIso(), job.id);
    markSent(platform);
    audit('publish.ok', `content:${content.id}`, { channel: ch.key, platform, post_id: r.post_id });
  } catch (e) {
    const cls = e instanceof PublishError ? e.errorClass : 'exception';
    const attempts = job.attempts + 1;
    const detail = [e.message, e.detail].filter(Boolean).join(' :: ').slice(0, 500);
    run(
      'insert into publish_result(schedule_id, content_id, account_id, platform, channel, ok, error_class, detail) values (?, ?, ?, ?, ?, 0, ?, ?)',
      s.id, content.id, account.id, platform, ch.key, cls, detail
    );
    if (cls === 'pending_integration' || cls === 'pending_config' || cls === 'pending_media') {
      run("update job set state = 'blocked', attempts = ?, last_error = ?, updated_at = ? where id = ?", attempts, e.message, nowIso(), job.id);
      run("update schedule set state = 'blocked', retry = ?, last_error = ? where id = ?", attempts, e.message, s.id);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      run("update job set state = 'failed', attempts = ?, last_error = ?, updated_at = ? where id = ?", attempts, e.message, nowIso(), job.id);
      run("update schedule set state = 'failed', retry = ?, last_error = ? where id = ?", attempts, e.message, s.id);
      markFailCooldown(platform);
      audit('publish.fail', `content:${content.id}`, { error: e.message, class: cls });
    } else {
      const next = new Date(Date.now() + 60000 * attempts).toISOString().replace('T', ' ').slice(0, 19);
      run("update job set state = 'retry', attempts = ?, run_at = ?, last_error = ?, updated_at = ? where id = ?", attempts, next, e.message, nowIso(), job.id);
      run("update schedule set state = 'retrying', retry = ?, last_error = ? where id = ?", attempts, e.message, s.id);
    }
  }
}

export async function tick() {
  if (setting('worker_enabled') !== '1') return { skipped: true };
  enqueueDueSchedules();
  const job = get("select * from job where state in ('queued','retry') and run_at <= ? order by id asc limit 1", nowIso());
  if (job) await runJob(job);
  return { ran: !!job };
}
