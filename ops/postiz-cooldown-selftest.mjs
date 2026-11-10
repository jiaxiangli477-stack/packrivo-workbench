/* Postiz 429 冷却短路 + 平台状态三态区分 隔离自测
   跑法：node ops/postiz-cooldown-selftest.mjs
   覆盖：
     1. 401/403 → 状态 connectivity=key_invalid、通道 pending_credential（不是"连不上"）
     2. 连接失败 → connectivity=unreachable、通道 pending_connect
     3. 200 → connectivity=ok、通道 ready
     4. 429 → 读 retry-after 进冷却（至少 60s）
     5. 冷却期内 listIntegrations / publish / upload 一律不往外发（桩请求计数不变）
     6. 429 无 retry-after → 兜底 900s 冷却 */
import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data', 'selftest-cooldown');
if (!DATA.startsWith(path.join(ROOT, 'data') + path.sep)) throw new Error('拒绝清理非 data 目录：' + DATA);
rmSync(DATA, { recursive: true, force: true });
mkdirSync(DATA, { recursive: true });

const STUB_PORT = 8799;
const KEY = 'stub-key-cooldown';
process.env.SWB_DATA = DATA;
process.env.POSTIZ_STUB_PORT = String(STUB_PORT);
process.env.POSTIZ_STUB_KEY = KEY;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  :: ' + detail : ''}`);
}

/* ---------- 可切模式的契约桩（计数一切真实请求） ---------- */
const INTEGRATIONS = [
  { id: 'int-x-0001', name: 'X', identifier: 'x', profile: 'p', disabled: false, customer: { id: 'c1', name: 'P' } },
];
let mode = 'ok';          // ok | auth | rate
let retryAfter = 0;       // 429 时回什么 retry-after（0 = 不带）
let hit = 0;              // 命中 /api/public/v1/* 的真实请求数

const stub = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/__stub/mode' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    mode = b.mode || 'ok';
    retryAfter = Number(b.retry_after || 0);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mode, retryAfter }));
  }
  if (p === '/__stub/hits' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ hit }));
  }
  if (!p.startsWith('/api/public/v1/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{}'); }
  hit += 1;
  if (mode === 'rate') {
    const h = { 'content-type': 'application/json' };
    if (retryAfter) h['retry-after'] = String(retryAfter);
    res.writeHead(429, h);
    return res.end(JSON.stringify({ msg: 'Too many requests' }));
  }
  if (mode === 'auth') {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ msg: 'Invalid API key' }));
  }
  if (req.headers.authorization !== KEY) {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ msg: 'Invalid API key' }));
  }
  if (p === '/api/public/v1/integrations') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(INTEGRATIONS));
  }
  if (p === '/api/public/v1/posts' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify([{ postId: 'stub-post-1', releaseURL: '' }]));
  }
  if (p === '/api/public/v1/upload' && req.method === 'POST') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id: 'img-1', path: '/media/img-1.png' }));
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  return res.end('{}');
});

await new Promise((r) => stub.listen(STUB_PORT, '127.0.0.1', r));

const postiz = await import('../app/postiz.mjs');
const { setSetting } = await import('../app/db.mjs');
const channels = await import('../app/channels.mjs');

async function setMode(m, ra = 0) {
  await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: m, retry_after: ra }) });
}
async function getHits() {
  return (await (await fetch(`http://127.0.0.1:${STUB_PORT}/__stub/hits`)).json()).hit;
}

/* 配置 base 与 key（直接写库，隔离数据目录） */
setSetting('postiz_base', `http://127.0.0.1:${STUB_PORT}`);
postiz.saveKey(KEY);
postiz.invalidateCache();

/* ---------- 1. 正常 key → ok / ready ---------- */
let v = await postiz.verify();
check('正常 key：verify ok 且通道数 1', v.ok === true && v.count === 1, JSON.stringify({ ok: v.ok, count: v.count }));
check('正常 key：status.connectivity=ok', postiz.status().connectivity === 'ok', postiz.status().connectivity);
check('正常 key：通道 state=ready', (await channels.channelCatalog()).find((c) => c.key === 'postiz')?.state === 'ready');

/* ---------- 2. 401 → key_invalid（不是连不上） ---------- */
await setMode('auth');
postiz.invalidateCache();
postiz.invalidateReachable();
let bad = null;
try { await postiz.listIntegrations(true); } catch (e) { bad = e; }
check('401 抛 pending_config（鉴权）', bad?.errorClass === 'pending_config', `${bad?.errorClass} :: ${bad?.message}`);
check('401 → status.connectivity=key_invalid', postiz.status().connectivity === 'key_invalid', postiz.status().connectivity);
check('401 → 通道 state=pending_credential', (await channels.channelCatalog()).find((c) => c.key === 'postiz')?.state === 'pending_credential');

/* ---------- 3. 连接失败 → unreachable / pending_connect ---------- */
setSetting('postiz_base', 'http://127.0.0.1:9');
postiz.invalidateCache();
postiz.invalidateReachable();
let dead = null;
try { await postiz.listIntegrations(true); } catch (e) { dead = e; }
check('连接失败抛 upstream_error', dead?.errorClass === 'upstream_error', `${dead?.errorClass} :: ${dead?.message?.slice(0, 60)}`);
check('连接失败 → connectivity=unreachable', postiz.status().connectivity === 'unreachable', postiz.status().connectivity);
check('连接失败 → 通道 state=pending_connect', (await channels.channelCatalog()).find((c) => c.key === 'postiz')?.state === 'pending_connect');

/* ---------- 4. 429 → 读 retry-after 进冷却 ---------- */
setSetting('postiz_base', `http://127.0.0.1:${STUB_PORT}`);
await setMode('rate', 120);
postiz.invalidateCache();
let rl = null;
try { await postiz.listIntegrations(true); } catch (e) { rl = e; }
check('429 抛 rate_limited', rl?.errorClass === 'rate_limited', `${rl?.errorClass} :: ${rl?.message?.slice(0, 60)}`);
const cd1 = postiz.cooldownLeftMs();
check('429 后进入冷却（>0 且 ≤120s+抖动）', cd1 > 0 && cd1 <= 125000, `cooldown_ms=${cd1}`);
check('status.cooldown_ms 同步 > 0', postiz.status().cooldown_ms > 0, `cooldown_ms=${postiz.status().cooldown_ms}`);

/* ---------- 5. 冷却期内零新增请求 ---------- */
const before = await getHits();
let blocked = 0;
// 三类会打网络的操作：列表 / 发布 / 上传，冷却期内都必须就地抛 rate_limited
for (const op of ['list', 'publish', 'upload']) {
  try {
    if (op === 'list') await postiz.listIntegrations(true);
    if (op === 'publish') await postiz.publish({ content: { title: 't', body: 'b' }, account: { platform: 'x' }, platform: 'x', schedule: null });
    if (op === 'upload') await postiz.uploadMedia(path.join(ROOT, 'ops', 'meta-3.png'));
  } catch (e) {
    if (e?.errorClass === 'rate_limited') blocked += 1;
  }
}
const after = await getHits();
check('冷却期内 list/publish/upload 全部被短路拦截', blocked === 3, `blocked=${blocked}/3`);
check('冷却期内桩请求零新增（hit 不变）', after === before, `before=${before} after=${after}`);
const cd2 = postiz.cooldownLeftMs();
check('冷却仍持续（没有因短路而重置）', cd2 > 0 && cd2 <= 125000, `cooldown_ms=${cd2}`);

/* ---------- 6. 429 无 retry-after → 兜底 900s ---------- */
// 先把冷却清零（直接重设模块级变量不可行，改走：新起一个极短冷却验证兜底逻辑用 60s 下限）
// 这里用独立方式验证：retry-after=0 时应取 900s。为避免长时间冷却污染，重新 import 一份新模块实例。
const freshQ = `../app/postiz.mjs?t=${Date.now()}`;
const fresh = await import(freshQ);
setSetting('postiz_base', `http://127.0.0.1:${STUB_PORT}`);
fresh.saveKey(KEY);
fresh.invalidateCache();
await setMode('rate', 0);   // 不带 retry-after
let rl2 = null;
try { await fresh.listIntegrations(true); } catch (e) { rl2 = e; }
check('429 无 retry-after → rate_limited', rl2?.errorClass === 'rate_limited', rl2?.errorClass);
check('无 retry-after 兜底冷却 ≈900s', fresh.cooldownLeftMs() > 890000 && fresh.cooldownLeftMs() <= 900000, `cooldown_ms=${fresh.cooldownLeftMs()}`);

/* ---------- 汇总 ---------- */
stub.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  console.log('失败项：');
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
