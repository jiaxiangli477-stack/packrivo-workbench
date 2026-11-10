/* Postiz 适配器端到端自测（隔离 DB + 本机契约桩，不动线上 8795 那份数据）
   跑法：node ops/postiz-selftest.mjs
   覆盖：Base URL 归一化 → Key 加密存 → /integrations 匹配 → now/schedule/draft 三种提交
        → 缺素材拦截（tiktok）→ 坏 Key 拦截（401）→ 结果落 publish_result */
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data', 'selftest');
if (!DATA.startsWith(path.join(ROOT, 'data') + path.sep)) throw new Error('拒绝清理非 data 目录：' + DATA);
rmSync(DATA, { recursive: true, force: true });
mkdirSync(DATA, { recursive: true });

const STUB_PORT = 8798;
const WB_PORT = 8797;
process.env.SWB_DATA = DATA;
process.env.SWB_PORT = String(WB_PORT);
process.env.SWB_HOST = '127.0.0.1';
process.env.POSTIZ_STUB_PORT = String(STUB_PORT);
process.env.POSTIZ_STUB_KEY = 'stub-key-123';

const STUB_KEY = 'stub-key-123';
const WB = `http://127.0.0.1:${WB_PORT}`;
const STUB = `http://127.0.0.1:${STUB_PORT}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  :: ' + detail : ''}`);
}

async function call(method, p, body) {
  const res = await fetch(WB + p, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function waitHealth(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(WB + '/api/health');
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function tickUntil(scheduleId, states = ['published', 'blocked', 'failed'], tries = 12) {
  for (let i = 0; i < tries; i++) {
    await call('POST', '/api/tick', {});
    const { json } = await call('GET', '/api/schedules');
    const s = (json.schedules || []).find((x) => x.id === scheduleId);
    if (s && states.includes(s.state)) return s;
    await new Promise((r) => setTimeout(r, 250));
  }
  const { json } = await call('GET', '/api/schedules');
  return (json.schedules || []).find((x) => x.id === scheduleId) || null;
}

async function stubLog() {
  const r = await fetch(STUB + '/__stub/log');
  return (await r.json()).received || [];
}

async function makeContent(platform, extra = {}) {
  const r = await call('POST', '/api/contents', {
    platform,
    title: 'Custom kraft mailer boxes for DTC brands',
    body: 'Rigid mailer boxes built to your dieline. MOQ 500 pcs, 300 gsm kraft, 12-day lead time.',
    hashtags: '#Packrivo #mailerbox',
    utm_url: 'https://packrivo.local/products/mailer-box?utm_source=postiz',
    status: 'approved',
    ...extra,
  });
  return r.json.id;
}

async function makeAccount(platform, handle) {
  const r = await call('POST', '/api/accounts', { platform, handle });
  return r.json.id;
}

async function schedule(contentId, accountId) {
  const r = await call('POST', '/api/schedules', { content_id: contentId, account_id: accountId, channel: 'postiz' });
  return r.json;
}

/* ---------- 启动：桩 → 工作台（隔离 DB） ---------- */
await import('./postiz-stub.mjs');
await new Promise((r) => setTimeout(r, 300));
await import('../app/server.mjs');
if (!(await waitHealth())) {
  console.error('工作台没起来，自测终止');
  process.exit(1);
}

/* ---------- 0. Base URL 归一化（纯函数） ---------- */
const { normalizeBase } = await import('../app/postiz.mjs');
check('Base 归一化：裸域名 → /api/public/v1', normalizeBase('http://127.0.0.1:5000') === 'http://127.0.0.1:5000/api/public/v1', normalizeBase('http://127.0.0.1:5000'));
check('Base 归一化：官方 API 域名 → /public/v1', normalizeBase('https://api.postiz.com') === 'https://api.postiz.com/public/v1', normalizeBase('https://api.postiz.com'));
check('Base 归一化：已带全路径不重复拼', normalizeBase('http://h:5000/api/public/v1/') === 'http://h:5000/api/public/v1');

/* ---------- 1. 配配置 + 存 Key + 验证连通 ---------- */
await call('PUT', '/api/settings', {
  postiz_base: STUB,
  publish_channel_default: 'postiz',
  postiz_type: 'now',
  worker_enabled: '1',
});
const keySave = await call('POST', '/api/channels/postiz/key', { key: STUB_KEY });
check('API Key 加密入库 + 只回 hint', keySave.json.saved === true && keySave.json.hint === '…-123', JSON.stringify(keySave.json));

const st = await call('GET', '/api/channels/postiz');
check('状态接口：configured=true 且 base 已归一化',
  st.json.configured === true && st.json.base === STUB + '/api/public/v1', JSON.stringify(st.json));

const v = await call('POST', '/api/channels/postiz/verify', {});
check('验证连通：通道数 5', v.json.ok === true && v.json.count === 5, JSON.stringify({ ok: v.json.ok, count: v.json.count }));
check('通道匹配：x / facebook_page / linkedin / instagram / tiktok 都命中',
  ['x', 'facebook_page', 'linkedin', 'instagram', 'tiktok'].every((p) => v.json.matched?.[p]),
  JSON.stringify(v.json.matched));

/* ---------- 2. now 通道：X 文字稿真发 ---------- */
const xAcc = await makeAccount('x', '@packrivo');
const xContent = await makeContent('x');
const xSch = await schedule(xContent, xAcc);
const xDone = await tickUntil(xSch.id);
check('X 排期 → published', xDone?.state === 'published', JSON.stringify({ state: xDone?.state, err: xDone?.last_error }));

const xRes = (await call('GET', '/api/results')).json.results.find((r) => r.schedule_id === xSch.id);
check('结果落库：ok=1 且拿到 stub post_id',
  xRes?.ok === 1 && String(xRes.platform_post_id).startsWith('stub-'), JSON.stringify({ ok: xRes?.ok, id: xRes?.platform_post_id, cls: xRes?.error_class }));

let log = await stubLog();
const xPost = log.find((e) => e.body?.posts?.[0]?.integration?.id === 'int-x-0001');
check('桩收到 now 请求体：type=now / __type=x / who_can_reply_post',
  xPost?.body?.type === 'now' && xPost?.body?.posts?.[0]?.settings?.__type === 'x' && xPost?.body?.posts?.[0]?.settings?.who_can_reply_post === 'everyone',
  JSON.stringify(xPost?.body?.posts?.[0]?.settings));
check('正文含标题/正文/标签/UTM 链接',
  typeof xPost?.body?.posts?.[0]?.value?.[0]?.content === 'string'
  && xPost.body.posts[0].value[0].content.includes('kraft mailer boxes')
  && xPost.body.posts[0].value[0].content.includes('#Packrivo')
  && xPost.body.posts[0].value[0].content.includes('utm_source=postiz'),
  (xPost?.body?.posts?.[0]?.value?.[0]?.content || '').slice(0, 120));

/* ---------- 3. schedule 模式：把 run_at 交给 Postiz ---------- */
await call('PUT', '/api/settings', { postiz_type: 'schedule' });
const liAcc = await makeAccount('linkedin', 'packrivo-company');
const liContent = await makeContent('linkedin');
const liSch = await schedule(liContent, liAcc);
const liDone = await tickUntil(liSch.id);
check('LinkedIn 排期 → published（schedule 模式）', liDone?.state === 'published', JSON.stringify({ state: liDone?.state, err: liDone?.last_error }));
log = await stubLog();
const liPost = log.find((e) => e.body?.posts?.[0]?.integration?.id === 'int-li-0003');
check('schedule 模式：type=schedule 且 date 是 UTC ISO',
  liPost?.body?.type === 'schedule' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(liPost?.body?.date || '') && liPost?.body?.posts?.[0]?.settings?.__type === 'linkedin-page',
  JSON.stringify({ type: liPost?.body?.type, date: liPost?.body?.date, __type: liPost?.body?.posts?.[0]?.settings?.__type }));
await call('PUT', '/api/settings', { postiz_type: 'now' });

/* ---------- 4. draft：只建草稿，不对外发 ---------- */
const fbAcc = await makeAccount('facebook_page', 'packrivo-page');
const fbContent = await makeContent('facebook_page');
const draft = await call('POST', '/api/channels/postiz/draft', { content_id: fbContent, account_id: fbAcc });
check('draft 接口返回 ok 与 post_id', draft.json.ok === true && String(draft.json.post_id).startsWith('stub-'), JSON.stringify(draft.json).slice(0, 200));
log = await stubLog();
const draftPost = log.find((e) => e.body?.type === 'draft');
check('桩收到 draft：settings.__type=facebook', draftPost?.body?.posts?.[0]?.settings?.__type === 'facebook', JSON.stringify(draftPost?.body?.posts?.[0]?.settings));

/* ---------- 5. 缺素材：TikTok 必须拦住（blocked，不重试、不假装成功） ---------- */
const ttAcc = await makeAccount('tiktok', 'packrivo-tiktok');
const ttContent = await makeContent('tiktok');
const ttSch = await schedule(ttContent, ttAcc);
const ttDone = await tickUntil(ttSch.id);
check('TikTok 无素材 → blocked', ttDone?.state === 'blocked', JSON.stringify({ state: ttDone?.state, err: ttDone?.last_error }));
const ttRes = (await call('GET', '/api/results')).json.results.find((r) => r.schedule_id === ttSch.id);
check('错误分类 pending_media 且写明原因', ttRes?.error_class === 'pending_media' && /必须带图/.test(ttRes?.detail || ''), JSON.stringify({ cls: ttRes?.error_class, d: ttRes?.detail }));

/* ---------- 6. 坏 Key：401 → pending_config，不重试 ---------- */
const badAcc = await makeAccount('facebook_page', 'packrivo-page-badkey');
const badContent = await makeContent('facebook_page');
const badSch = await schedule(badContent, badAcc);
await call('POST', '/api/channels/postiz/key', { key: 'wrong-key' });
const badVerify = await call('POST', '/api/channels/postiz/verify', {});
check('坏 Key 验证 → ok=false 且 error_class=pending_config',
  badVerify.json.ok === false && badVerify.json.error_class === 'pending_config', JSON.stringify(badVerify.json).slice(0, 200));
const badDone = await tickUntil(badSch.id);
check('坏 Key 发布 → schedule blocked', badDone?.state === 'blocked', JSON.stringify({ state: badDone?.state, err: badDone?.last_error }));
const badRes = (await call('GET', '/api/results')).json.results.find((r) => r.schedule_id === badSch.id);
check('坏 Key 错误分类 pending_config + 401 提示', badRes?.error_class === 'pending_config' && /鉴权/.test(badRes?.detail || ''), JSON.stringify({ cls: badRes?.error_class, d: badRes?.detail }));
await call('POST', '/api/channels/postiz/key', { key: STUB_KEY });

/* ---------- 7. 不可达地址：给出可执行报错 ---------- */
await call('PUT', '/api/settings', { postiz_base: 'http://127.0.0.1:9' });
const dead = await call('POST', '/api/channels/postiz/verify', {});
check('地址不可达 → upstream_error 且带地址与原因',
  dead.json.ok === false && dead.json.error_class === 'upstream_error' && /连不上 Postiz/.test(dead.json.error || ''),
  JSON.stringify(dead.json).slice(0, 220));
await call('PUT', '/api/settings', { postiz_base: STUB });

/* ---------- 汇总 ---------- */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length) {
  console.log('失败项：');
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
