/* 批次一（2026-11-batch1）HTTP 级验收断言。
   和前两个 harness 的分工：
     ops/verify-batch1.mjs      —— 库函数级（门禁 / postiz 响应解析 / 迁移）
     ops/verify-pub07-queue.mjs —— 队列级（入队、认领、unknown 不重发）
     ops/assert-batch1.mjs      —— 这一份：起真服务（默认 8796）+ 本地 Postiz 桩（默认 18811），
                                   全部走真实 HTTP 路由与真实 worker ticker，用桩的请求日志做证据。

   纪律：不碰 8795 生产库、不碰真实发布账号、不调付费模型；数据目录必须是一次性临时目录，
   端口必须不是 8795。断言的是「正确行为」，不是「问题复现成功」。

   用法：node ops/assert-batch1.mjs [--keep]
   退出码：0 全部通过；1 有失败（末尾打印失败清单与服务端日志尾巴）。 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.ASSERT_PORT || 8796);
const STUB_PORT = Number(process.env.ASSERT_STUB_PORT || 18811);
const TOKEN = `assert-b1-${process.pid}`;
const POSTIZ_KEY = 'assert-b1-postiz-key';
const DATA = path.resolve(process.env.ASSERT_DATA || 'E:\\破甲工作区\\.tmp\\swb-b1-assert');
const KEEP = process.argv.includes('--keep');

if (PORT === 8795 || STUB_PORT === 8795) {
  console.error('[assert] 拒绝在 8795 上跑：那是生产实例');
  process.exit(2);
}
if (!/swb-b1-assert/.test(path.basename(DATA))) {
  console.error(`[assert] 数据目录必须是临时目录（名字含 swb-b1-assert），当前 ${DATA}`);
  process.exit(2);
}

const results = [];
let pass = 0;
let fail = 0;
function ck(group, name, cond, detail = '') {
  const ok = !!cond;
  if (ok) pass += 1; else fail += 1;
  results.push({ group, name, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok || !detail ? '' : `  <${String(detail).slice(0, 300)}>${''}`}`);
  return ok;
}
function head(title) { console.log(`\n[${title}]`); }

/* ---------- 时间工具（与应用一致：UTC 的 YYYY-MM-DD HH:MM:SS） ---------- */
function fmt(ms) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 19); }
const FUTURE = '2099-01-01 00:00:00';

/* ---------- HTTP ---------- */
async function call(method, p, body, opt = {}) {
  const headers = {};
  if (!opt.noToken) headers['x-swb-token'] = TOKEN;
  let payload;
  if (body !== undefined) {
    const ct = opt.contentType || 'application/json';
    headers['content-type'] = ct;
    payload = ct === 'application/json' ? JSON.stringify(body) : String(body);
  }
  if (opt.token !== undefined) headers['x-swb-token'] = opt.token;
  Object.assign(headers, opt.headers || {});
  const t0 = Date.now();
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method, headers, body: payload, redirect: 'manual' });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON（静态资源） */ }
  return { status: r.status, json, text, headers: r.headers, ms: Date.now() - t0 };
}

function rawGet(p, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'GET', headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, text: d, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

/* ---------- 桩控制 ---------- */
async function stubLog() {
  const r = await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/log`);
  return await r.json();
}
async function stubReset() {
  await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
}
async function stubNext(next) {
  await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/config`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ next }) });
}
async function postCount() {
  const { log } = await stubLog();
  return log.filter((e) => e.method === 'POST').length;
}
async function posts() {
  const { log } = await stubLog();
  return log.filter((e) => e.method === 'POST');
}

/* ---------- 库直连（只读观察 + 造 fixture，不写业务状态） ---------- */
let DBH = null;
function db() {
  if (!DBH) {
    DBH = new DatabaseSync(path.join(DATA, 'workbench.db'));
    DBH.exec('pragma busy_timeout=5000');
  }
  return DBH;
}
const q1 = (sql, ...p) => db().prepare(sql).get(...p) || null;
const qa = (sql, ...p) => db().prepare(sql).all(...p);
const ex = (sql, ...p) => db().prepare(sql).run(...p);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, { ms = 20000, step = 250, label = '' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    let v = null;
    try { v = fn(); } catch { v = null; }
    if (v) return v;
    await sleep(step);
  }
  throw new Error(`等待超时${label ? '：' + label : ''}`);
}

/* ---------- 进程 ---------- */
let serverProc = null;
let stubProc = null;
const logs = {};
function logPath(name) { return path.join(DATA, `${name}.log`); }
function tailLog(name, n = 40) {
  try {
    const lines = fs.readFileSync(logPath(name), 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-n).join('\n');
  } catch { return '(无日志)'; }
}

function spawnChild(name, script, env) {
  const fd = fs.openSync(logPath(name), 'a');
  const p = spawn(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  logs[name] = p;
  return p;
}

async function waitHealth(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.ok) return await r.json();
    } catch { /* 还没起来 */ }
    await sleep(200);
  }
  throw new Error('服务 30 秒内没起来');
}

/* ---------- 业务动作 ---------- */
async function newContent(title, platform = 'linkedin') {
  const r = await call('POST', '/api/contents', { platform, title, body: `批次一断言正文：${title}` });
  if (r.status !== 200 || !r.json?.id) throw new Error(`建内容失败 ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.id;
}
async function approve(id) {
  const r = await call('POST', `/api/contents/${id}/review`, { decision: 'approve' });
  if (r.status !== 200) throw new Error(`审批失败 ${r.status} ${r.text.slice(0, 200)}`);
  return r.json;
}
async function reject(id) {
  return await call('POST', `/api/contents/${id}/review`, { decision: 'reject' });
}
async function newAccount(handle, platform, integrationId = '', integrationIdentifier = '') {
  const r = await call('POST', '/api/accounts', {
    platform, handle, display_name: handle, integration_id: integrationId, integration_identifier: integrationIdentifier,
  });
  if (r.status !== 200 || !r.json?.id) throw new Error(`建账号失败 ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.id;
}
async function schedule(contentId, accountId, opts = {}) {
  return await call('POST', '/api/schedules', {
    content_id: contentId, account_id: accountId, run_at: opts.runAt || FUTURE, publish_mode: opts.mode || 'now',
  });
}
function resetRate(platform = 'linkedin') {
  ex('delete from rate_state where platform = ?', platform);
}
async function runNow(scheduleId) {
  return await call('POST', `/api/schedules/${scheduleId}/run-now`, {});
}

/* ======================= 主流程 ======================= */
async function main() {
  // 数据目录：只删自己那一个
  if (fs.existsSync(DATA)) {
    const resolved = path.resolve(DATA);
    if (path.basename(resolved) !== path.basename(DATA) || !/swb-b1-assert/.test(path.basename(resolved))) {
      throw new Error(`拒绝删除 ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  fs.mkdirSync(DATA, { recursive: true });

  stubProc = spawnChild('stub', 'ops/stub-postiz.mjs', { STUB_PORT: String(STUB_PORT), STUB_KEY: POSTIZ_KEY });
  await until(() => true, { ms: 50 });
  // 等桩真的在听
  await until(async () => { try { await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/log`); return true; } catch { return false; } }, { ms: 15000, label: '桩启动' });

  serverProc = spawnChild('server', 'app/server.mjs', {
    SWB_PORT: String(PORT),
    SWB_DATA: DATA,
    SWB_API_TOKEN: TOKEN,
    SWB_CRYPTO_WEAK: '1',
    SWB_ALLOW_HOSTS: '',
  });
  const health = await waitHealth();
  console.log(`[assert] 服务已起 127.0.0.1:${PORT}  data=${DATA}`);
  console.log(`[assert] health=${JSON.stringify(health)}`);

  /* ---------- A. SEC-02 访问控制 ---------- */
  head('A. SEC-02 访问控制');
  {
    const noTok = await call('GET', '/api/contents', undefined, { noToken: true });
    ck('A', '无令牌读 /api/contents 被拒 401 + token_required', noTok.status === 401 && noTok.json?.code === 'token_required', `${noTok.status} ${noTok.text.slice(0, 120)}`);

    const badTok = await call('GET', '/api/contents', undefined, { token: 'wrong-token-000000' });
    ck('A', '错误令牌被拒 401 + token_invalid', badTok.status === 401 && badTok.json?.code === 'token_invalid', `${badTok.status} ${badTok.text.slice(0, 120)}`);

    const goodTok = await call('GET', '/api/contents');
    ck('A', '正确令牌读 /api/contents 200', goodTok.status === 200 && Array.isArray(goodTok.json?.contents), `${goodTok.status}`);

    const badHost = await rawGet('/api/health', { Host: 'evil.example:8796' });
    ck('A', 'Host 不在白名单被拒 403 + bad_host', badHost.status === 403 && /bad_host/.test(badHost.text), `${badHost.status} ${badHost.text.slice(0, 120)}`);

    const openHealth = await call('GET', '/api/health', undefined, { noToken: true });
    ck('A', '/api/health 免令牌 200', openHealth.status === 200 && openHealth.json?.ok === true, `${openHealth.status}`);

    const plain = await call('POST', '/api/contents', 'platform=linkedin&body=x', { contentType: 'application/x-www-form-urlencoded' });
    ck('A', '写操作非 JSON 被拒 415 + bad_content_type', plain.status === 415 && plain.json?.code === 'bad_content_type', `${plain.status} ${plain.text.slice(0, 120)}`);

    const crossOrigin = await call('POST', '/api/contents', { platform: 'linkedin', body: 'x' }, { headers: { origin: 'https://evil.example' } });
    ck('A', '跨站 Origin 被拒 403 + bad_origin', crossOrigin.status === 403 && crossOrigin.json?.code === 'bad_origin', `${crossOrigin.status} ${crossOrigin.text.slice(0, 120)}`);

    const sameOrigin = await call('POST', '/api/contents', { platform: 'linkedin', title: '同源写', body: 'x' }, { headers: { origin: `http://127.0.0.1:${PORT}`, 'sec-fetch-site': 'same-origin' } });
    ck('A', '同源 + JSON 写操作放行 200', sameOrigin.status === 200 && !!sameOrigin.json?.id, `${sameOrigin.status} ${sameOrigin.text.slice(0, 120)}`);

    const envJs = await call('GET', '/swb-env.js', undefined, { noToken: true });
    ck('A', '/swb-env.js 免令牌且注入真实令牌', envJs.status === 200 && envJs.text.includes(TOKEN), `${envJs.status} ${envJs.text.slice(0, 120)}`);

    const idx = await call('GET', '/', undefined, { noToken: true });
    ck('A', '首页 no-store（改完刷新能拿到新前端）', idx.status === 200 && String(idx.headers.get('cache-control') || '').includes('no-store'), `${idx.status} cc=${idx.headers.get('cache-control')}`);

    const denyAudit = q1("select count(*) as n from audit_log where action = 'http.deny'");
    ck('A', '拒绝事件落审计 http.deny', Number(denyAudit?.n || 0) >= 4, `n=${denyAudit?.n}`);
  }

  /* ---------- B. 外部对接配置与真实探测 ---------- */
  head('B. Postiz 配置与连通性');
  await stubReset();
  {
    const put = await call('PUT', '/api/settings', {
      postiz_base: `http://127.0.0.1:${STUB_PORT}/api`,
      postiz_api_key: POSTIZ_KEY,
      publish_channel_default: 'postiz',
    });
    ck('B', 'PUT /api/settings 接受已知键', put.status === 200 && put.json?.ok === true && (put.json?.applied || []).includes('postiz_base'), `${put.status} ${put.text.slice(0, 200)}`);

    const unknownKey = await call('PUT', '/api/settings', { not_a_key: '1' });
    ck('B', '未知设置键被拒', /未知设置项/.test(String(unknownKey.json?.error || '')), `${unknownKey.status} ${unknownKey.text.slice(0, 160)}`);

    // 设置页是整表单一次 PUT，缺任何一行都会整单 400 —— 用真实键表回归
    const uiKeys = {
      publish_mode: 'semi', publish_channel_default: 'postiz', public_base_url: 'https://social.packrivo.com',
      review_sensitive_extra: '', review_sensitive_enabled: '1', weekly_quota: '5', brand_tone: '专业',
      primary_lang: 'en', market: '欧美', webhook_url: '', postiz_base: `http://127.0.0.1:${STUB_PORT}/api`,
      postiz_type: 'now', postiz_integration_map: '{}', postiz_settings: '{}', video_api_path: '/videos/generations',
      apify_token: '', apify_actor: '', image_api_base: '', image_api_key: '', image_api_model: '',
      image_api_backup_base: '', image_api_backup_key: '', image_api_backup_model: '',
      image_api_fallback_base: '', image_api_fallback_key: '', image_api_fallback_model: '',
      telegram_bot_token: '', telegram_chat_id: '', llm_task_models: '{}',
    };
    const full = await call('PUT', '/api/settings', uiKeys);
    ck('B', '设置页整单保存（30 键）不被拒', full.status === 200 && full.json?.ok === true, `${full.status} ${full.text.slice(0, 240)}`);

    // 整单校验：带未知键时已知键也不能落库（原来边写边校验，400 之前已经写进去一半）
    const partial = await call('PUT', '/api/settings', { market: '整单不该落盘', not_a_key: '1' });
    const marketAfter = q1("select v from setting where k = 'market'")?.v;
    ck('B', '带未知键整单拒写（已知键不落盘）', partial.status === 400 && marketAfter !== '整单不该落盘', `${partial.status} market=${marketAfter}`);

    const verify = await call('POST', '/api/channels/postiz/verify', {});
    ck('B', 'verify 走真实 GET /integrations 并报 ok', verify.status === 200 && verify.json?.ok === true, `${verify.status} ${verify.text.slice(0, 200)}`);

    const { log } = await stubLog();
    const getInt = log.find((e) => e.method === 'GET' && e.path === '/api/public/v1/integrations');
    ck('B', '桩收到 GET /api/public/v1/integrations', !!getInt, JSON.stringify(log).slice(0, 200));
    ck('B', 'Authorization 是裸 key（不是 Bearer）', getInt?.auth === POSTIZ_KEY, `auth=${String(getInt?.auth).slice(0, 40)}`);

    const status = await call('GET', '/api/channels/postiz');
    ck('B', '通道状态 connectivity=ok', status.json?.connectivity === 'ok', `${status.status} ${JSON.stringify(status.json).slice(0, 200)}`);
    ck('B', 'base 归一化到 /api/public/v1', String(status.json?.base || '').endsWith(`:${STUB_PORT}/api/public/v1`), status.json?.base);
  }

  /* ---------- C. 账号 ↔ integration 绑定（PUB-04） ---------- */
  head('C. 账号与 integration 绑定');
  let accA;
  let accB;
  let accC;
  let accYT;
  {
    accA = await newAccount('page-a', 'linkedin', 'int-A', 'linkedin');
    accB = await newAccount('page-b', 'linkedin', 'int-B', 'linkedin');
    accC = await newAccount('page-c', 'linkedin', '', '');
    accYT = await newAccount('chan-yt', 'youtube', 'int-YT', 'youtube');

    const a = q1('select integration_id, integration_identifier from account where id = ?', accA);
    const b = q1('select integration_id, integration_identifier from account where id = ?', accB);
    const c = q1('select integration_id from account where id = ?', accC);
    ck('C', 'account A 绑定 int-A 落库', a?.integration_id === 'int-A' && a?.integration_identifier === 'linkedin', JSON.stringify(a));
    ck('C', 'account B 绑定 int-B 落库', b?.integration_id === 'int-B', JSON.stringify(b));
    ck('C', 'account C 未绑定（空字符串，不是 NULL）', c?.integration_id === '', JSON.stringify(c));

    const patch = await call('PATCH', `/api/accounts/${accB}`, { integration_id: 'int-A' });
    ck('C', 'PATCH 可改绑定', patch.status === 200 && patch.json?.changed >= 1 && q1('select integration_id from account where id = ?', accB)?.integration_id === 'int-A', `${patch.status} ${patch.text.slice(0, 160)}`);

    const back = await call('PATCH', `/api/accounts/${accB}`, { integration_id: 'int-B', integration_identifier: 'linkedin' });
    ck('C', '改回 int-B', back.status === 200 && q1('select integration_id from account where id = ?', accB)?.integration_id === 'int-B', `${back.status}`);

    const bindAudit = q1("select count(*) as n from audit_log where action = 'account.bind'");
    ck('C', '改绑定留审计 account.bind', Number(bindAudit?.n || 0) >= 2, `n=${bindAudit?.n}`);
  }

  /* ---------- D. 审核门禁（PUB-01）：0 次出站 ---------- */
  head('D. 审核门禁：不可发的一律拦在建排期那一刻');
  await stubReset();
  const dPending = await newContent('门禁-未审');
  const dRejected = await newContent('门禁-被驳');
  await reject(dRejected);
  const dApproved = await newContent('门禁-已批-未绑定账号');
  await approve(dApproved);
  const dYT = await newContent('门禁-平台不一致');
  await approve(dYT);
  {
    const r1 = await schedule(dPending, accA);
    ck('D', '未审核内容建排期被拒 content_not_approved', r1.status === 400 && r1.json?.code === 'content_not_approved', `${r1.status} ${r1.text.slice(0, 160)}`);

    const r2 = await schedule(dRejected, accA);
    ck('D', '被驳回内容建排期被拒 content_rejected', r2.status === 400 && r2.json?.code === 'content_rejected', `${r2.status} ${r2.text.slice(0, 160)}`);

    const r3 = await schedule(dApproved, accC);
    ck('D', '账号未绑定 integration 被拒 account_unbound', r3.status === 400 && r3.json?.code === 'account_unbound', `${r3.status} ${r3.text.slice(0, 160)}`);

    const r4 = await schedule(dYT, accYT);
    ck('D', '内容与账号平台不一致被拒 account_platform_mismatch', r4.status === 400 && r4.json?.code === 'account_platform_mismatch', `${r4.status} ${r4.text.slice(0, 160)}`);

    ck('D', '四种门禁全部 0 次出站', (await postCount()) === 0, `posts=${await postCount()}`);

    const schedRows = q1('select count(*) as n from schedule');
    ck('D', '门禁失败没有留下排期行', Number(schedRows?.n || 0) === 0, `n=${schedRows?.n}`);

    const gateAudit = qa("select detail from audit_log where action = 'schedule.create' order by id desc limit 5");
    ck('D', '未审核内容没有产生 schedule.create 审计', gateAudit.length === 0, `n=${gateAudit.length}`);
  }

  /* ---------- E. 真发布走各自绑定的 integration（PUB-04 真路径） ---------- */
  head('E. 发布路由到各自绑定的 integration');
  await stubReset();
  let schA;
  let schB;
  {
    const cA = await newContent('发布-A-页面');
    const cB = await newContent('发布-B-页面');
    await approve(cA);
    await approve(cB);
    resetRate();
    const sa = await schedule(cA, accA);
    ck('E', 'A 账号建排期成功', sa.status === 200 && !!sa.json?.id, `${sa.status} ${sa.text.slice(0, 160)}`);
    schA = sa.json.id;
    await runNow(schA);
    const settled = await until(() => {
      const s = q1('select * from schedule where id = ?', schA);
      return s && ['published', 'failed', 'blocked'].includes(s.state) ? s : null;
    }, { ms: 20000, label: 'A 排期落终态' });
    ck('E', 'A 排期落到 published', settled.state === 'published', JSON.stringify(settled).slice(0, 240));
    ck('E', 'A 排期 delivery_state=submitted', settled.delivery_state === 'submitted', settled.delivery_state);
    ck('E', 'A 排期记下 postiz_post_id（远端任务号）', /^task-\d+$/.test(String(settled.postiz_post_id || '')), `postiz_post_id=${settled.postiz_post_id}`);
    ck('E', 'A 排期 platform_post_id 与公开链接为空（Postiz 只回任务号）', String(settled.platform_post_id || '') === '', `platform_post_id=${settled.platform_post_id}`);

    const pA = await posts();
    ck('E', 'A 的发布打到 int-A（不是列表首个 int-C）', pA.length === 1 && pA[0].integrationId === 'int-A', JSON.stringify(pA));
    ck('E', 'A 的发布 type=now', pA[0]?.type === 'now', pA[0]?.type);

    resetRate();
    const sb = await schedule(cB, accB);
    schB = sb.json?.id;
    await runNow(schB);
    const settledB = await until(() => {
      const s = q1('select * from schedule where id = ?', schB);
      return s && ['published', 'failed', 'blocked'].includes(s.state) ? s : null;
    }, { ms: 20000, label: 'B 排期落终态' });
    ck('E', 'B 排期落到 published', settledB.state === 'published', JSON.stringify(settledB).slice(0, 240));

    const allPosts = await posts();
    const pB = allPosts[allPosts.length - 1];
    ck('E', 'B 的发布打到 int-B（两个账号互不串）', pB?.integrationId === 'int-B', JSON.stringify(pB));

    const cRow = q1('select status from content where id = ?', (await call('GET', `/api/schedules`)).json?.schedules?.[0]?.content_id || 0);
    const res = await call('GET', '/api/results');
    const row = (res.json?.results || []).find((r) => Number(r.schedule_id) === Number(schA)) || null;
    ck('E', 'publish_result 记 ok=1 且带 postiz_post_id', row && Number(row.ok) === 1 && /^task-\d+$/.test(String(row.postiz_post_id || '')), JSON.stringify(row).slice(0, 240));
    const cAstatus = q1('select status from content where id = (select content_id from schedule where id = ?)', schA);
    ck('E', '真发出后内容状态变 published', cAstatus?.status === 'published', cAstatus?.status);
  }

  /* ---------- F. PUB-02 并发草稿：模式按请求走，不写全局 ---------- */
  head('F. PUB-02 并发草稿不改全局 postiz_type');
  await stubReset();
  {
    const cA = await newContent('并发草稿-A');
    const cB = await newContent('并发草稿-B');
    await approve(cA);
    await approve(cB);
    const before = q1("select v from setting where k = 'postiz_type'")?.v ?? null;
    const [ra, rb] = await Promise.all([
      call('POST', '/api/channels/postiz/draft', { content_id: cA, account_id: accA }),
      call('POST', '/api/channels/postiz/draft', { content_id: cB, account_id: accB }),
    ]);
    ck('F', '两个并发草稿都成功', ra.status === 200 && ra.json?.ok === true && rb.status === 200 && rb.json?.ok === true, `${ra.status}/${rb.status} ${ra.text.slice(0, 100)} ${rb.text.slice(0, 100)}`);

    const p = await posts();
    ck('F', '桩收到 2 次 POST /posts', p.length === 2, JSON.stringify(p.map((x) => x.integrationId)));
    ck('F', '两次都是 type=draft（没有互改成 now）', p.length === 2 && p.every((x) => x.type === 'draft'), JSON.stringify(p.map((x) => x.type)));
    const ids = p.map((x) => x.integrationId).sort();
    ck('F', '各按自己的账号打到 int-A / int-B', JSON.stringify(ids) === JSON.stringify(['int-A', 'int-B']), JSON.stringify(ids));

    const after = q1("select v from setting where k = 'postiz_type'")?.v ?? null;
    ck('F', '并发草稿没把全局 postiz_type 改掉（只当默认值读，不写回）', before === after && after === 'now', `${before} -> ${after}`);

    const cAs = q1('select status from content where id = ?', cA);
    const cBs = q1('select status from content where id = ?', cB);
    ck('F', '草稿不改内容发布态（仍 approved）', cAs?.status === 'approved' && cBs?.status === 'approved', `${cAs?.status}/${cBs?.status}`);

    const schN = q1("select count(*) as n from schedule where content_id in (?, ?)", cA, cB);
    ck('F', '草稿不建排期行', Number(schN?.n || 0) === 0, `n=${schN?.n}`);

    const mode = await call('GET', '/api/channels/postiz');
    ck('F', '通道状态回报的 post_type_mode 仍是 now', mode.json?.post_type_mode === 'now', mode.json?.post_type_mode);
  }

  /* ---------- G. 队列里的 draft 模式 ---------- */
  head('G. 排期按 draft 模式发送后不进已发布统计');
  await stubReset();
  {
    const cid = await newContent('队列草稿');
    await approve(cid);
    resetRate();
    const sc = await schedule(cid, accA, { mode: 'draft' });
    ck('G', '建排期时 publish_mode 按请求取 draft', sc.status === 200 && sc.json?.publish_mode === 'draft', `${sc.status} ${sc.text.slice(0, 160)}`);
    await runNow(sc.json.id);
    const s = await until(() => {
      const row = q1('select * from schedule where id = ?', sc.json.id);
      return row && ['published', 'submitted', 'failed', 'blocked'].includes(row.state) ? row : null;
    }, { ms: 20000, label: 'draft 排期落终态' });
    ck('G', 'draft 排期 state=submitted（不冒充 published）', s.state === 'submitted', `${s.state}/${s.delivery_state}`);
    ck('G', 'draft 排期 delivery_state=draft', s.delivery_state === 'draft', s.delivery_state);
    const cs = q1('select status from content where id = ?', cid);
    ck('G', 'draft 发送后内容仍是 approved（没被判成已发布）', cs?.status === 'approved', cs?.status);
    const pr = q1('select * from publish_result where schedule_id = ? order by id desc limit 1', sc.json.id);
    ck('G', 'publish_result.delivery_state=draft，接口可据此过滤', pr?.delivery_state === 'draft', JSON.stringify(pr).slice(0, 240));
    const cnt = q1("select count(*) as n from content where status = 'published' and id = ?", cid);
    ck('G', '已发布口径不包含草稿', Number(cnt?.n || 0) === 0, `n=${cnt?.n}`);
  }

  /* ---------- H. 结果未知不重发（PUB-03/07） ---------- */
  head('H. 远端结果未知：不重发、等人工核对');
  await stubReset();
  {
    const cid = await newContent('未知结果');
    await approve(cid);
    resetRate();
    const sc = await schedule(cid, accA);
    await stubNext('no-id');
    await runNow(sc.json.id);
    const s = await until(() => {
      const row = q1('select * from schedule where id = ?', sc.json.id);
      return row && ['published', 'failed', 'blocked', 'submitted'].includes(row.state) ? row : null;
    }, { ms: 20000, label: '未知结果排期落终态' });
    ck('H', '排期落到 failed（不装作已发）', s.state === 'failed', `${s.state}/${s.delivery_state}`);
    ck('H', 'delivery_state=unknown', s.delivery_state === 'unknown', s.delivery_state);

    const pr = q1('select * from publish_result where schedule_id = ? order by id desc limit 1', sc.json.id);
    ck('H', 'publish_result.error_class=unknown_result', pr?.error_class === 'unknown_result', JSON.stringify(pr).slice(0, 300));

    const job = q1('select * from job where payload like ? order by id desc limit 1', `%${sc.json.id}%`);
    ck('H', '作业 failed 且不消耗 attempt（不算可重试失败）', job?.state === 'failed' && Number(job?.attempts || 0) === 0, JSON.stringify(job).slice(0, 240));

    const n1 = await postCount();
    for (let i = 0; i < 3; i += 1) { await call('POST', '/api/tick'); await sleep(400); }
    await sleep(7000);   // 至少两个 worker ticker 周期
    const n2 = await postCount();
    ck('H', '之后的 tick 与 ticker 一次都不再 POST', n1 === n2 && n1 === 1, `${n1} -> ${n2}`);

    const row2 = q1('select state, delivery_state from schedule where id = ?', sc.json.id);
    ck('H', '排期仍停在 failed/unknown，没被自动重排', row2?.state === 'failed' && row2?.delivery_state === 'unknown', JSON.stringify(row2));

    const unkAudit = q1("select count(*) as n from audit_log where action = 'publish.unknown'");
    ck('H', '未知结果落审计 publish.unknown', Number(unkAudit?.n || 0) >= 1, `n=${unkAudit?.n}`);

    await stubNext('ok');
  }

  /* ---------- I. 发送前版本漂移被拦（schedule_stale） ---------- */
  head('I. 排期绑定版本：内容改过后不再拿旧通行证发送');
  await stubReset();
  {
    const cid = await newContent('版本漂移');
    await approve(cid);
    resetRate();
    const sc = await schedule(cid, accA);
    ck('I', '建排期记下 content_version', Number(sc.json?.content_version || 0) >= 1, JSON.stringify(sc.json));

    // 内容被改（版本 +1）后重新过审，但排期仍绑 v1 —— 模拟「改完重审、忘了重建排期」
    ex('update content set content_version = content_version + 1 where id = ?', cid);
    await approve(cid);

    const jobsBefore = Number(q1('select count(*) as n from job')?.n || 0);
    const stale = await runNow(sc.json.id);
    ck('I', 'run-now 面对旧版本排期返回 400 + schedule_stale', stale.status === 400 && stale.json?.code === 'schedule_stale', `${stale.status} ${stale.text.slice(0, 200)}`);
    const jobsAfter = Number(q1('select count(*) as n from job')?.n || 0);
    ck('I', '被拦的 run-now 不入队（job 不新增）', jobsAfter === jobsBefore, `${jobsBefore} -> ${jobsAfter}`);

    // 再走队列那条路：把排期放回到期，ticker 入队时必须同样拦住
    ex("update schedule set state = 'pending', run_at = ? where id = ?", fmt(Date.now() - 1000), sc.json.id);
    const before = await postCount();
    await call('POST', '/api/tick');
    await sleep(1500);
    const s = await until(() => {
      const row = q1('select * from schedule where id = ?', sc.json.id);
      return row && ['blocked', 'failed', 'published'].includes(row.state) ? row : null;
    }, { ms: 15000, label: '漂移排期落终态' });
    ck('I', '版本漂移的排期被拦下（blocked，等人重新排期）', s.state === 'blocked', `${s.state}/${s.delivery_state}`);
    ck('I', '拦截原因写明 schedule_stale', /schedule_stale|版本/.test(String(s.last_error || '')), String(s.last_error).slice(0, 200));
    ck('I', '被拦的排期 0 次出站', (await postCount()) === before, `${before} -> ${await postCount()}`);
    const ga = q1("select count(*) as n from audit_log where action = 'publish.gate'");
    ck('I', '门禁拦截落审计 publish.gate', Number(ga?.n || 0) >= 1, `n=${ga?.n}`);
  }

  /* ---------- J. 驳回即撤（真实 review 路由） ---------- */
  head('J. 内容被驳回时撤掉未发出的排期');
  await stubReset();
  {
    const cid = await newContent('驳回撤回');
    await approve(cid);
    resetRate();
    const sc = await schedule(cid, accA);   // run_at 在 2099，ticker 不会碰
    const rj = await reject(cid);
    ck('J', '驳回响应带 cancelled 计数', rj.status === 200 && Number(rj.json?.cancelled || 0) >= 1, `${rj.status} ${rj.text.slice(0, 200)}`);
    const s = q1('select * from schedule where id = ?', sc.json.id);
    ck('J', '排期被置为 cancelled', s?.state === 'cancelled', `${s?.state}/${s?.delivery_state}`);
    ck('J', '驳回后 0 次出站', (await postCount()) === 0, `posts=${await postCount()}`);
  }

  /* ---------- K. 限流冷却不消耗 attempt ---------- */
  head('K. 限流等待不吃失败次数');
  await stubReset();
  {
    const cid = await newContent('限流冷却');
    await approve(cid);
    resetRate();
    const sc = await schedule(cid, accA);
    ex("insert or replace into rate_state(platform, day, count, last_at, cooldown_until) values (?, date('now'), 0, '', ?)", 'linkedin', fmt(Date.now() + 3600 * 1000));
    await runNow(sc.json.id);
    const s = await until(() => {
      const row = q1('select * from schedule where id = ?', sc.json.id);
      return row && (row.state === 'queued' || row.state === 'retry' || ['failed', 'published', 'blocked'].includes(row.state)) ? row : null;
    }, { ms: 15000, label: '冷却期排期状态' });
    ck('K', '冷却期内不发送：排期仍排队等待', s.state === 'queued' || s.state === 'retry', `${s.state}/${s.delivery_state}`);
    const job = q1('select * from job where payload like ? order by id desc limit 1', `%${sc.json.id}%`);
    ck('K', '作业 attempts 仍为 0（冷却不算失败）', Number(job?.attempts || 0) === 0, JSON.stringify(job).slice(0, 240));
    ck('K', '冷却期 0 次出站', (await postCount()) === 0, `posts=${await postCount()}`);
    ex("delete from rate_state where platform = ?", 'linkedin');
  }

  /* ---------- L. SEC-01 静态清理 ---------- */
  head('L. SEC-01 凭据清理');
  {
    const probe = path.join(ROOT, 'ops', '_probe-cloud-endpoints.mjs');
    ck('L', '硬编码密钥的探针脚本已删除', !fs.existsSync(probe), probe);

    const pats = [
      /sk-[A-Za-z0-9_-]{20,}/,
      /AKIA[0-9A-Z]{16}/,
      /gh[pousr]_[A-Za-z0-9]{20,}/,
      /xox[baprs]-[A-Za-z0-9-]{10,}/,
      /\b[0-9a-f]{32}\.[0-9a-f]{16}\b/,
    ];
    const skipDirs = new Set(['node_modules', '.git', 'data', 'dist', 'build']);
    const hits = [];
    const walk = (dir) => {
      let ents;
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (skipDirs.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.(mjs|js|json|md|txt|yml|yaml|ps1|bat|cmd|env|html|css)$/i.test(e.name)) continue;
        if (e.name === '_probe-cloud-endpoints.mjs') continue;
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
        for (const re of pats) {
          const m = text.match(re);
          if (m) { hits.push(`${path.relative(ROOT, full)} :: ${re.source} :: ${m[0].slice(0, 4)}***`); break; }
        }
      }
    };
    for (const d of ['app', 'web', 'ops', 'docs', 'service', 'tools', 'deploy']) walk(path.join(ROOT, d));
    ck('L', '源码树无明文密钥形态（扫描 app/web/ops/docs/service/tools/deploy）', hits.length === 0, hits.slice(0, 8).join(' | '));

    const settingsRoute = await call('GET', '/api/settings');
    const secrets = settingsRoute.json?.secrets || {};
    const values = settingsRoute.json?.settings || {};
    const leaked = Object.keys(secrets).filter((k) => String(values[k] || '').length > 0);
    ck('L', '/api/settings 不回传任何密钥明文', leaked.length === 0, leaked.join(','));
    ck('L', '已保存的密钥只给 4 位提示', String(secrets?.postiz_api_key?.hint || '').length > 0 && String(values?.postiz_api_key || '') === '', JSON.stringify(secrets.postiz_api_key));

    const audits = q1("select count(*) as n from audit_log where action = 'settings.update'");
    const auditRow = q1("select detail from audit_log where action = 'settings.update' order by id desc limit 1");
    const detail = String(auditRow?.detail || '');
    ck('L', '设置审计不含密钥明文', !detail.includes(POSTIZ_KEY), detail.slice(0, 200) || `n=${audits?.n}`);
  }

  /* ---------- M. 前端接线（静态证据） ---------- */
  head('M. 前端接线');
  {
    const js = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
    ck('M', '前端 api() 带 x-swb-token', js.includes('x-swb-token') && js.includes('/swb-env.js'));
    ck('M', '审核页有「已批待排期」入口', js.includes('data-sch2') && js.includes('待排期'));
    ck('M', '账号页可绑 integration（data-bind / a-int）', js.includes('data-bind') && js.includes('integration_id'));
    ck('M', '账号新增行提交 integration 字段', js.includes('#a-int') || js.includes('a-intname'));
    ck('M', '排期表单带 publish_mode', js.includes('publish_mode'));
  }

  /* ---------- 收尾 ---------- */
  console.log(`\n================ 结果：通过 ${pass} / ${pass + fail} ================`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('失败清单：');
    for (const f of failed) console.log(`  - [${f.group}] ${f.name}  ${f.detail}`);
    console.log('\n--- server.log 尾部 ---\n' + tailLog('server', 30));
    console.log('\n--- stub.log 尾部 ---\n' + tailLog('stub', 15));
  }
  fs.writeFileSync(path.join(DATA, 'assert-report.json'), JSON.stringify({ pass, fail, results }, null, 2), 'utf8');
  console.log(`报告：${path.join(DATA, 'assert-report.json')}`);
  return failed.length === 0;
}

let ok = false;
try {
  ok = await main();
} catch (e) {
  fail += 1;
  console.error(`\n[assert] 运行中断：${e?.message || e}`);
  console.error(tailLog('server', 40));
  console.error(tailLog('stub', 20));
} finally {
  for (const [name, p] of Object.entries(logs)) {
    try { p.kill(); } catch { /* 已退出 */ }
    if (KEEP) console.log(`[assert] 保留 ${name} pid=${p.pid}`);
  }
  try { DBH?.close(); } catch { /* 忽略 */ }
  if (!KEEP && fs.existsSync(DATA)) {
    if (/swb-b1-assert/.test(path.basename(path.resolve(DATA)))) {
      try { fs.rmSync(path.resolve(DATA), { recursive: true, force: true }); } catch { /* 文件占用时留档 */ }
    }
  }
}
process.exit(ok && fail === 0 ? 0 : 1);
