// PUB-07 / PUB-01 / PUB-03 队列层离线断言（不联网、不碰生产库、SWB_DATA 指向临时目录）。
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ISO = mkdtempSync(path.join(tmpdir(), 'swb-queue-'));
process.env.SWB_DATA = ISO;
mkdirSync(ISO, { recursive: true });
process.env.SWB_CRYPTO_WEAK = '1';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✔ ${name}`); }
  else { fail += 1; console.log(`  ✘ ${name} ${extra}`); }
}

const dbmod = await import('../app/db.mjs');
const { get, all, run, setSetting } = dbmod;
const queue = await import('../app/queue.mjs');
const channels = await import('../app/channels.mjs');
const { PublishError, RESULT_UNKNOWN_CLASS } = await import('../app/errors.mjs');

setSetting('publish_channel_default', 'mock');
setSetting('worker_enabled', '1');
// 关闭 mock 限流，避免连续 tick 之间撞最小间隔
run("update platform_limit set min_interval_sec = 0, daily_cap = 100000, cooldown_after_fail = 1 where platform = 'mock'");
run("update platform_limit set min_interval_sec = 0, daily_cap = 100000, cooldown_after_fail = 1 where platform = 'webhook'");

function nowIso() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function seedAccount(id, handle) {
  run(`insert into account(id, platform, handle, status) values (?, 'mock', ?, 'active')`, id, handle);
}
function seedContent(id, status, approvedVersion) {
  run(`insert into content(id, platform, body, status, content_version, approved_version) values (?, 'mock', 'body', ?, 1, ?)`,
    id, status, approvedVersion);
}
function mkSchedule(contentId, accountId, publishMode = 'now', channel = 'mock') {
  const r = run(`insert into schedule(content_id, account_id, channel, run_at, state, content_version, publish_mode, delivery_state) values (?,?,?,?,?,?,?,?)`,
    contentId, accountId, channel, nowIso(), 'pending', 1, publishMode, 'pending');
  return Number(r.lastInsertRowid);
}

console.log('[queue-assert] 隔离目录:', ISO);

// [A] PUB-01：draft / pending_review 不得入队发送
console.log('\n[A] PUB-01 入队门禁：draft / pending_review 不得入队发送');
seedAccount(11, 'acct-a1'); seedContent(11, 'draft', 0);
seedAccount(12, 'acct-a2'); seedContent(12, 'pending_review', 0);
mkSchedule(11, 11); mkSchedule(12, 12);
queue.enqueueDueSchedules();
const s11 = get('select * from schedule where content_id = 11');
const s12 = get('select * from schedule where content_id = 12');
ok('draft 排期被 blocked（不发送）', s11.state === 'blocked', '实际=' + s11.state);
ok('pending_review 排期被 blocked（不发送）', s12.state === 'blocked', '实际=' + s12.state);
ok('draft 排期未生成 job', all('select * from job').filter(j => (j.payload || '').includes('"schedule_id":11')).length === 0);
ok('pending_review 排期未生成 job', all('select * from job').filter(j => (j.payload || '').includes('"schedule_id":12')).length === 0);

// [B] 已批准内容正常发布（认领+建 job 原子）
console.log('\n[B] 已批准内容走 mock 通道正常发布');
seedAccount(21, 'acct-b1'); seedContent(21, 'approved', 1);
const sch21 = mkSchedule(21, 21);
queue.enqueueDueSchedules();
const s21q = get('select * from schedule where id = ?', sch21);
ok('已批准排期变成 queued 且带 intent_id', s21q.state === 'queued' && !!s21q.intent_id, JSON.stringify(s21q));
const j21 = get('select * from job where intent_id = ?', s21q.intent_id);
ok('生成对应 job（认领+建作业同事务）', !!j21 && j21.state === 'queued', j21 && ('state=' + j21.state));
const t1 = await queue.tick();
ok('tick 执行一次 runJob', t1.ran === true);
const s21d = get('select * from schedule where id = ?', sch21);
ok('发布后 schedule=published', s21d.state === 'published', '实际=' + s21d.state);
ok('发布后 delivery_state=submitted（mock 无平台号）', s21d.delivery_state === 'submitted', '实际=' + s21d.delivery_state);
const pr21 = get('select * from publish_result where schedule_id = ? order by id desc limit 1', sch21);
ok('publish_result ok=1', pr21 && pr21.ok === 1, pr21 && ('ok=' + pr21.ok));

// [C] 入队后驳回 → 发送前二次门禁拦截
console.log('\n[C] 入队后驳回，发送前二次门禁拦截');
seedAccount(31, 'acct-c1'); seedContent(31, 'approved', 1);
const sch31 = mkSchedule(31, 31);
queue.enqueueDueSchedules();
run("update content set status = 'rejected', approved_version = 0 where id = 31");
await queue.tick();
const s31 = get('select * from schedule where id = ?', sch31);
ok('入队后驳回 → schedule 落 failed 不发送', s31.state === 'failed', '实际=' + s31.state + ' err=' + s31.last_error);
const pr31 = get('select * from publish_result where schedule_id = ? and ok = 1 order by id desc limit 1', sch31);
ok('入队后驳回不产生 ok=1 的 publish_result', !pr31);

// [D] 结果未知不重发：用 webhook 通道语义（channel 不是 mock，anyId 为空 → RESULT_UNKNOWN）
console.log('\n[D] 结果未知不重发（PUB-07/PUB-03）');
const origWebhookPublish = channels.channels.webhook.publish;
let webhookCalls = 0;
channels.channels.webhook.publish = async () => {
  webhookCalls += 1;
  return { ok: true, post_id: '', url: '' };  // 2xx 但无 id → 结果未知
};
seedAccount(41, 'acct-d1'); seedContent(41, 'approved', 1);
const sch41 = mkSchedule(41, 41, 'now', 'webhook');
queue.enqueueDueSchedules();
await queue.tick();
await queue.tick();  // 若重发，这里会再次调用 publish
channels.channels.webhook.publish = origWebhookPublish;
ok('结果未知时 publish 只调用一次', webhookCalls === 1, '调用次数=' + webhookCalls);
const s41 = get('select * from schedule where id = ?', sch41);
ok('结果未知 schedule 落 unknown 不重发', s41.delivery_state === 'unknown', '实际=' + s41.delivery_state);
const j41 = get('select * from job where intent_id = ?', s41.intent_id);
ok('结果未知 job 落 failed（等人工核对）', j41 && j41.state === 'failed', j41 && ('state=' + j41.state));

// [E] draft 模式发布不计入 published：mock publish 不带 delivery_state，由 queue 按 publish_mode 推导
console.log('\n[E] draft 模式发布不把内容标记为 published（PUB-03）');
const origMockPublish = channels.channels.mock.publish;
channels.channels.mock.publish = async () => ({ ok: true, post_id: 'mock-draft-1' });  // 无 delivery_state
seedAccount(51, 'acct-e1'); seedContent(51, 'approved', 1);
const sch51 = mkSchedule(51, 51, 'draft', 'mock');
queue.enqueueDueSchedules();
await queue.tick();
channels.channels.mock.publish = origMockPublish;
const s51 = get('select * from schedule where id = ?', sch51);
const c51 = get('select * from content where id = 51');
ok('draft 发布后 schedule=submitted（非 published）', s51.state === 'submitted', '实际=' + s51.state);
ok('draft 发布后 delivery_state=draft', s51.delivery_state === 'draft', '实际=' + s51.delivery_state);
ok('draft 发布后内容仍为 approved（不进已发布统计）', c51.status === 'approved', '实际=' + c51.status);

console.log(`\n==============================`);
console.log(`通过 ${pass} / ${pass + fail}`);
console.log(`==============================`);
try { rmSync(ISO, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
