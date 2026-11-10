import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { all, get, run, setting, setSetting, audit, nowIso, ROOT, DATA_DIR } from './db.mjs';
import { encrypt, decrypt, keyHint } from './crypto.mjs';
import { SECRET_KEYS } from './secrets.mjs';
import { chat, testEndpoint, pingBuiltin } from './llm.mjs';
import { channelCatalog } from './channels.mjs';
import { status as postizStatus, saveKey as postizSaveKey, verify as postizVerify, publish as postizPublish, listIntegrations as postizIntegrations, integrationFor as postizIntegrationFor, TYPE_CANDIDATES, NO_POSTIZ_CHANNEL } from './postiz.mjs';
import { discover, SOURCES } from './sources.mjs';
import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';
import { warmupAlibaba } from './browser.mjs';
import { comfyStatus, listCheckpoints, generateImage, sdServiceStatus, sdServiceGenerate } from './comfy.mjs';
import { auditContent } from './quality.mjs';
import { tick } from './queue.mjs';

const PORT = Number(process.env.SWB_PORT || 8795);
/* 素材目录跟着数据目录走：隔离实例（SWB_DATA 指别处）也要能读到自己的 media，
   否则拿 live 库快照跑端到端，图片一律 404，测试结论不可信 */
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const HOST = process.env.SWB_HOST || '127.0.0.1';
const WEB_DIR = path.join(ROOT, 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 4 * 1024 * 1024) throw new Error('body too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid json body');
  }
}

const routes = [];
const on = (method, pattern, fn) => routes.push({ method, pattern, fn });

/* 落地页可达性检查：保存产品前先探一次，打不开就不让保存 */
async function assertReachable(url) {
  if (!url) return;
  const tryFetch = async (method) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      return await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
    } finally { clearTimeout(t); }
  };
  let r;
  try { r = await tryFetch('HEAD'); } catch {}
  if (!r || !r.ok) {
    try { r = await tryFetch('GET'); } catch {}
  }
  if (!r || !r.ok) throw new Error('落地页打不开' + (r ? '（HTTP ' + r.status + '）' : '') + '：' + url);
}

/* 模型思考过程泄漏识别：这类文本绝不能进内容库 */
const LEAK_PATTERNS = [
  /we need (answer|output|craft|respond)/i,
  /i need (to )?(respond|answer|craft|produce)/i,
  /let me (think|craft|write|analyze)/i,
  /(^|\n)\s*Here('| i)s (the|my) (plan|thinking)/i,
  /只输出\s*JSON/i,
  /需要(输出|返回)\s*JSON/i,
  /^(\s*)\x60\x60\x60/,
  /json object\.?\s*(need|we|i)\b/i,
];
function looksLikeReasoning(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return LEAK_PATTERNS.some((re) => re.test(t));
}

/* ---------- 品牌知识库 ---------- */
const KB_LABELS = { brand: '品牌', product: '产品', audience: '目标客户', tone: '语气', term: '术语/卖点', forbidden: '禁用/避免', case: '案例', competitor: '同行' };

function kbContext(limitChars = 3500) {
  const rows = all('select kind, title, content from kb_item where enabled = 1 order by weight desc, id asc');
  if (!rows.length) return '';
  const byKind = {};
  for (const r of rows) {
    if (!byKind[r.kind]) byKind[r.kind] = [];
    byKind[r.kind].push(`- ${r.title}: ${r.content}`);
  }
  let out = '【品牌知识库】（以下为硬约束：品牌事实、目标客户、语气、术语以这里为准，不得编造与这里冲突的信息）\n';
  for (const k of Object.keys(byKind)) out += `# ${KB_LABELS[k] || k}\n${byKind[k].join('\n')}\n`;
  return out.slice(0, limitChars);
}
/* ---------- 基础 ---------- */
on('GET', /^\/api\/health$/, async () => ({ ok: true, at: nowIso(), version: '0.1.0' }));

on('GET', /^\/api\/overview$/, async () => {
  const gw = await pingBuiltin();
  const counts = {
    accounts: get('select count(*) c from account').c,
    products: get('select count(*) c from product').c,
    hotspots: get('select count(*) c from hotspot').c,
    contents: get('select count(*) c from content').c,
    pendingReview: get("select count(*) c from content where status = 'pending_review'").c,
    scheduled: get("select count(*) c from schedule where state in ('pending','queued')").c,
    published: get("select count(*) c from publish_result where ok = 1 and channel <> 'mock'").c,
    published_test: get("select count(*) c from publish_result where ok = 1 and channel = 'mock'").c,
    failed: get("select count(*) c from publish_result where ok = 0").c,
    demoMetrics: get("select count(*) c from metric where source = 'demo'").c,
  };
  return { counts, gateway: gw, cryptoWeak: process.env.SWB_CRYPTO_WEAK === '1', settings: all('select k, v from setting order by k').length };
});

on('GET', /^\/api\/settings$/, async () => {
  const out = {};
  const secrets = {};
  for (const r of all('select k, v from setting order by k')) {
    if (SECRET_KEYS.has(r.k)) {
      // 密钥既不回明文也不回密文：只告诉前端"存没存 + 后 4 位"
      const plain = setting(r.k);
      out[r.k] = '';
      secrets[r.k] = { saved: !!plain, hint: plain ? keyHint(plain) : '' };
      continue;
    }
    out[r.k] = r.v;
  }
  // 表里还没有的密钥项也要出现，前端才能拿到"未保存"状态
  for (const k of SECRET_KEYS) {
    if (k in out) continue;
    out[k] = '';
    secrets[k] = { saved: false, hint: '' };
  }
  // Postiz Key 真正生效的是 credential 表那条（/api/channels/postiz/key 写的），设置页必须跟它一致
  {
    const pz = postizStatus();
    out.postiz_api_key = '';
    secrets.postiz_api_key = { saved: !!pz.key_saved, hint: pz.key_hint || '' };
  }
  return { settings: out, secrets };
});

on('PUT', /^\/api\/settings$/, async (m, b) => {
  const known = new Set(all('select k from setting').map((r) => r.k));
  for (const k of SECRET_KEYS) known.add(k);
  const applied = [];
  const skipped = [];
  const rejected = [];
  for (const [k, v] of Object.entries(b || {})) {
    if (!known.has(k)) { rejected.push(k); continue; }
    if (SECRET_KEYS.has(k)) {
      // 留空 = 不改动（设置页的密码框故意不回显，空串不能当成"清空密钥"）；JSON null = 明确清空
      if (v === null) {
        if (k === 'postiz_api_key') postizSaveKey('');
        else setSetting(k, '');
        applied.push(k); continue;
      }
      if (String(v).trim() === '') { skipped.push(k); continue; }
      if (k === 'postiz_api_key') { postizSaveKey(String(v).trim()); applied.push(k); continue; }
    }
    setSetting(k, v);
    applied.push(k);
  }
  if (rejected.length) throw new Error('未知设置项（拒绝写入）：' + rejected.join(', '));
  // 审计只留证据不留密钥：密钥记后 4 位，其余截断 200 字
  const values = {};
  for (const k of applied) {
    if (k === 'postiz_api_key') { values[k] = postizStatus().key_hint || ''; continue; }
    values[k] = SECRET_KEYS.has(k) ? keyHint(setting(k)) : String(setting(k)).slice(0, 200);
  }
  audit('settings.update', '', { changed: applied, skipped, values });
  return { ok: true, applied, skipped };
});

/* ---------- 账号 ---------- */
on('GET', /^\/api\/accounts$/, async () => ({
  accounts: all(`select a.*, (select count(*) from credential c where c.owner_kind='account' and c.owner_id=a.id) as cred_count
                 from account a order by a.id desc`).map((a) => ({
    ...a,
    status_view: a.cred_count > 0 && a.session_state === 'ok' ? '已授权' : '未授权',
  })),
}));

on('POST', /^\/api\/accounts$/, async (m, b) => {
  if (!b.platform || !b.handle) throw new Error('platform 与 handle 必填');
  const r = run(
    'insert into account(platform, handle, display_name, profile_url, kind, status, proxy, fingerprint_dir, note) values (?,?,?,?,?,?,?,?,?)',
    b.platform, b.handle, b.display_name || '', b.profile_url || '', b.kind || 'business', b.status || 'active', b.proxy || '', b.fingerprint_dir || '', b.note || ''
  );
  audit('account.create', `id:${r.lastInsertRowid}`, { platform: b.platform, handle: b.handle });
  return { id: Number(r.lastInsertRowid) };
});

on('PATCH', /^\/api\/accounts\/(\d+)$/, async (m, b) => {
  const id = Number(m[1]);
  const fields = ['display_name', 'profile_url', 'kind', 'status', 'proxy', 'fingerprint_dir', 'note', 'session_state'];
  const sets = [];
  const vals = [];
  for (const f of fields) if (f in b) { sets.push(`${f} = ?`); vals.push(b[f]); }
  if (!sets.length) return { ok: true, changed: 0 };
  run(`update account set ${sets.join(', ')} where id = ?`, ...vals, id);
  return { ok: true, changed: sets.length };
});

on('DELETE', /^\/api\/accounts\/(\d+)$/, async (m) => {
  run('delete from account where id = ?', Number(m[1]));
  return { ok: true };
});

on('POST', /^\/api\/accounts\/(\d+)\/probe$/, async (m) => {
  const acc = get('select * from account where id = ?', Number(m[1]));
  if (!acc) throw new Error('账号不存在');

  const cred = (field) => {
    const r = get("select cipher from credential where owner_kind = 'account' and owner_id = ? and field = ? order by id desc limit 1", acc.id, field);
    if (!r) return null;
    try { return decrypt(r.cipher); } catch { return null; }
  };
  const mark = (state, extra) => run('update account set session_state = ? where id = ?', state, acc.id) && { state, ...extra };

  if (acc.platform === 'mastodon') {
    const instance = (cred('instance') || (acc.profile_url || '').replace(/^https?:\/\//, '').split('/')[0] || '').replace(/\/$/, '');
    const token = cred('access_token');
    if (!instance || !token) return mark('missing_credential', { ok: false, reason: '缺 instance 或 access_token，先点「填凭据」' });
    try {
      const r = await fetch('https://' + instance + '/api/v1/accounts/verify_credentials', { headers: { authorization: 'Bearer ' + token } });
      if (!r.ok) return mark('auth_failed', { ok: false, reason: 'Mastodon 验证失败 HTTP ' + r.status });
      const j = await r.json();
      run("update account set session_state = 'ok', handle = ?, profile_url = ? where id = ?",
        '@' + j.acct, 'https://' + instance + '/@' + j.acct, acc.id);
      return { ok: true, state: 'ok', reason: '已验证：@' + j.acct };
    } catch (e) {
      return mark('network_error', { ok: false, reason: '连不上 ' + instance + '：' + e.message });
    }
  }

  if (acc.platform === 'bluesky') {
    const handle = cred('handle') || (acc.handle || '').replace(/^@/, '');
    const pw = cred('app_password');
    if (!handle || !pw) return mark('missing_credential', { ok: false, reason: '缺 handle 或 app_password，先点「填凭据」' });
    try {
      const r = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: handle, password: pw }),
      });
      if (!r.ok) return mark('auth_failed', { ok: false, reason: 'Bluesky 登录失败 HTTP ' + r.status });
      const j = await r.json();
      run("update account set session_state = 'ok', handle = ?, profile_url = ? where id = ?",
        '@' + j.handle, 'https://bsky.app/profile/' + j.handle, acc.id);
      return { ok: true, state: 'ok', reason: '已验证：@' + j.handle };
    } catch (e) {
      return mark('network_error', { ok: false, reason: '连不上 bsky.social：' + e.message });
    }
  }

  run("update account set session_state = 'pending_integration' where id = ?", acc.id);
  return {
    ok: false,
    state: 'pending_integration',
    reason: '这个平台还没有直连通道（Mastodon / Bluesky 已支持），要么走 Postiz，要么等浏览器会话模块',
  };
});

on('POST', /^\/api\/accounts\/(\d+)\/credential$/, async (m, b) => {
  const id = Number(m[1]);
  if (!b.field || !b.value) throw new Error('field 与 value 必填');
  const r = run('insert into credential(owner_kind, owner_id, field, cipher, hint) values (?,?,?,?,?)',
    'account', id, b.field, encrypt(b.value), keyHint(b.value));
  audit('credential.write', `account:${id}`, { field: b.field });
  return { id: Number(r.lastInsertRowid), hint: keyHint(b.value) };
});

on('GET', /^\/api\/accounts\/(\d+)\/credential$/, async (m) => ({
  credentials: all('select id, field, hint, created_at from credential where owner_kind = ? and owner_id = ? order by id desc', 'account', Number(m[1])),
}));

/* ---------- 模型接入 ---------- */
on('GET', /^\/api\/models$/, async () => ({
  endpoints: all('select id, name, kind, base_url, model, key_hint, priority, enabled, last_ok_at, last_error from model_endpoint order by priority asc, id asc'),
  builtin: await pingBuiltin(),
}));

on('POST', /^\/api\/models$/, async (m, b) => {
  if (!b.name || !b.base_url || !b.model) throw new Error('name / base_url / model 必填');
  const r = run(
    'insert into model_endpoint(name, kind, base_url, model, api_key_cipher, key_hint, priority, enabled) values (?,?,?,?,?,?,?,?)',
    b.name, b.kind || 'text', b.base_url, b.model, b.api_key ? encrypt(b.api_key) : '', keyHint(b.api_key || ''), Number(b.priority || 100), b.enabled === false ? 0 : 1
  );
  audit('model.create', `id:${r.lastInsertRowid}`, { name: b.name, kind: b.kind || 'text' });
  return { id: Number(r.lastInsertRowid) };
});

on('PATCH', /^\/api\/models\/(\d+)$/, async (m, b) => {
  const id = Number(m[1]);
  const sets = [];
  const vals = [];
  for (const f of ['name', 'kind', 'base_url', 'model', 'priority', 'enabled']) if (f in b) { sets.push(`${f} = ?`); vals.push(b[f]); }
  if (b.api_key) { sets.push('api_key_cipher = ?'); vals.push(encrypt(b.api_key)); sets.push('key_hint = ?'); vals.push(keyHint(b.api_key)); }
  if (!sets.length) return { ok: true };
  run(`update model_endpoint set ${sets.join(', ')} where id = ?`, ...vals, id);
  return { ok: true };
});

on('DELETE', /^\/api\/models\/(\d+)$/, async (m) => {
  run('delete from model_endpoint where id = ?', Number(m[1]));
  return { ok: true };
});

on('POST', /^\/api\/models\/(\d+)\/test$/, async (m) => {
  const e = get('select * from model_endpoint where id = ?', Number(m[1]));
  if (!e) throw new Error('接口不存在');
  const r = await testEndpoint(e.base_url, e.model, e.api_key_cipher ? decrypt(e.api_key_cipher) : '');
  run('update model_endpoint set last_ok_at = ?, last_error = ? where id = ?', r.ok ? nowIso() : null, r.ok ? '' : (r.error || ''), e.id);
  return r;
});

on('POST', /^\/api\/models\/test$/, async (m, b) => testEndpoint(b.base_url, b.model, b.api_key || ''));

/* ---------- 产品 ---------- */
on('GET', /^\/api\/products$/, async () => ({ products: all('select * from product order by id desc') }));

on('POST', /^\/api\/products$/, async (m, b) => {
  if (!b.sku || !b.name) throw new Error('sku 与 name 必填');
  if (b.url) await assertReachable(b.url);
  const r = run('insert into product(sku, name, selling_points, params, target_markets, keywords, url) values (?,?,?,?,?,?,?)',
    b.sku, b.name, b.selling_points || '', b.params || '', b.target_markets || '', b.keywords || '', b.url || '');
  return { id: Number(r.lastInsertRowid) };
});

on('PATCH', /^\/api\/products\/(\d+)$/, async (m, b) => {
  const id = Number(m[1]);
  if (b.url) await assertReachable(b.url);
  const sets = [];
  const vals = [];
  for (const f of ['sku', 'name', 'selling_points', 'params', 'target_markets', 'keywords', 'url']) if (f in b) { sets.push(`${f} = ?`); vals.push(b[f]); }
  if (sets.length) run(`update product set ${sets.join(', ')} where id = ?`, ...vals, id);
  return { ok: true };
});

on('DELETE', /^\/api\/products\/(\d+)$/, async (m) => {
  run('delete from product where id = ?', Number(m[1]));
  return { ok: true };
});

/* ---------- 爆款库 ---------- */
on('GET', /^\/api\/hotspots$/, async () => ({ hotspots: all('select * from hotspot order by score desc, id desc limit 200') }));

on('POST', /^\/api\/hotspots$/, async (m, b) => {
  if (!b.platform || (!b.url && !b.title)) throw new Error('platform 且 url/title 至少一个');
  const stats = typeof b.stats === 'string' ? b.stats : JSON.stringify(b.stats || {});
  const r = run('insert into hotspot(platform, kind, keyword, url, author, title, published, snippet, stats, score, score_type, source) values (?,?,?,?,?,?,?,?,?,?,?,?)',
    b.platform, b.kind || 'post', b.keyword || '', b.url || '', b.author || '', b.title || '', b.published || '',
    b.snippet || '', stats, Number(b.score) || 0, b.score_type || 'manual', b.source || 'manual');
  audit('hotspot.add', `id:${r.lastInsertRowid}`, { platform: b.platform });
  return { id: Number(r.lastInsertRowid) };
});

on('DELETE', /^\/api\/hotspots\/(\d+)$/, async (m) => {
  run('delete from hotspot where id = ?', Number(m[1]));
  return { ok: true };
});

on('POST', /^\/api\/hotspots\/(\d+)\/deconstruct$/, async (m) => {
  const h = get('select * from hotspot where id = ?', Number(m[1]));
  if (!h) throw new Error('爆款不存在');
  const prompt = `你是外贸社媒内容分析师。下面是一条${h.platform}上的爆款/参考帖，请拆解它的结构，只输出 JSON，不要解释。
信息：标题/开场：${h.title || '(无)'}
作者：${h.author || '(无)'}
数据：${h.stats}
原始链接：${h.url || '(无)'}
摘要/字幕片段：${(h.snippet || '').slice(0, 300) || '(无)'}
发布时间：${h.published || '(未知)'}

输出 JSON 字段：
{"hook":"前3秒/第一行抓人的手法","pain":"击中的痛点","proof":"用什么做可信度(数据/演示/对比)","cta":"结尾引导动作","format":"图文/短视频/口播","structure":["按顺序的段落骨架，最多6条"],"reusable":"可复用到包装类B2B产品的结构结论"}。`;
  const r = await chat({ task: 'deconstruct', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.3, maxTokens: 1600 });
  const obj = extractJson(r.content, ['reusable']) || { raw: r.content.slice(0, 800) };
  run('update hotspot set structure = ? where id = ?', JSON.stringify(obj), h.id);
  return { ok: true, structure: obj, via: r.via };
});

/* ---------- AI 二创 ---------- */
function shingles(text, n = 4) {
  const clean = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const w = clean.split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(' '));
  return set;
}
function similarity(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return Math.round((hit / A.size) * 1000) / 10;
}

/* 模型输出里常混着推理过程与代码块，这里取「最后一个能解析且带指定字段的 JSON 对象」 */
function jsonObjectsIn(text) {
  const s = String(text || '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') {
        depth--;
        if (depth === 0) {
          try {
            const o = JSON.parse(s.slice(i, j + 1));
            if (o && typeof o === 'object') out.push(o);
          } catch {}
          break;
        }
      }
    }
  }
  return out;
}

function extractJson(text, required = []) {
  let s = String(text || '').replace(/```(?:json)?/gi, '');
  const candidates = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const frag = s.slice(i, j + 1);
          try {
            const obj = JSON.parse(frag);
            if (!required.length || required.every((k) => k in obj)) candidates.push(obj);
          } catch {}
          i = j;
          break;
        }
      }
    }
  }
  return candidates.length ? candidates[candidates.length - 1] : null;
}

const JSON_RULE = '\n只输出一个 JSON 对象：第一个字符是 {，最后一个字符是 }。不要解释、不要 Markdown 代码块、不要在 JSON 前后写任何文字。';

/* 敏感项闸门：命中的内容即使 AI 打分通过，也必须过人工（Q4 决策） */
const SENSITIVE = [
  { code: 'price', label: '价格/折扣', re: /(\$\s?\d|usd\s?\d|price|pricing|discount|\d{1,2}\s?%\s?off|报价|折扣)/i },
  { code: 'promise', label: '承诺/保证', re: /(guarantee|100\s?%|free shipping|money back|refund|warranty|保证|承诺|包退)/i },
  { code: 'cert', label: '认证/环保声明', re: /(fsc|fda|iso\s?\d|bpi|certified|compostable|biodegradable|可降解|认证)/i },
  { code: 'case', label: '客户案例', re: /(case study|customer story|client results|our client|客户案例)/i },
  { code: 'contact', label: '联系方式', re: /(whatsapp|contact us at|@[a-z0-9-]+\.|\+\d{1,3}[\s-]?\d{6,})/i },
];

function sensitiveHits(text) {
  if (setting('review_sensitive_enabled') !== '1') return [];
  const hits = [];
  const extra = String(setting('review_sensitive_extra') || '').split(/[,，\s]+/).filter(Boolean);
  for (const rule of SENSITIVE) {
    const m = String(text || '').match(rule.re);
    if (m) hits.push({ code: rule.code, label: rule.label, match: m[0].slice(0, 30) });
  }
  for (const term of extra) {
    if (String(text || '').toLowerCase().includes(term.toLowerCase())) hits.push({ code: 'custom', label: `自定义词:${term}`, match: term });
  }
  return hits;
}

const PLATFORM_STYLE = {
  facebook_page: 'Facebook 主页：开头一行钩子，2-3 段短句，结尾一个明确 CTA，控制在 600 字符内',
  facebook_group: 'Facebook 群组：先给群友一个有用结论，再带出产品，语气像同行分享，禁止硬广口吻',
  instagram: 'Instagram：第一行强钩子，正文 4-6 行，短句 + emoji 克制，结尾 5-8 个精准标签',
  threads: 'Threads：一句话钩子 + 3-5 条短句串，口语化，结尾提问引互动',
  tiktok: 'TikTok：口播脚本，前 3 秒钩子，分镜标注(画面/字幕/时长)，结尾引导评论或点击主页',
  youtube: 'YouTube：视频标题 + 前 15 秒脚本 + 描述区文案（含时间轴与链接）',
  pinterest: 'Pinterest：标题即卖点，描述 200 字符内，关键词自然堆叠，指向落地页',
  linkedin: 'LinkedIn：B2B 专业口吻，一段行业洞察 + 一段产品价值 + 一个提问式收尾',
  x: 'X：280 字符内，一句主张 + 一条证据 + 一个链接，不要话题堆砌',
  reddit: 'Reddit：标题像提问或经验分享，正文先讲自己踩过的坑和数据，结尾给结论，不要放链接堆砌，不放标签',
  quora: 'Quora：回答体，先直接给答案，再分点解释，最后补一句产品背景，不写营销腔',
  warrior_forum: 'Warrior Forum：同行视角分享供应链经验，先给可执行建议再提产品，结尾开放式问题',
  alibaba: 'Alibaba 国际站：产品标题 + 5 条卖点 + 参数表 + 询盘引导，B2B 采购口吻',
  made_in_china: '中国制造网：产品描述 + 规格 + 起订量 + 交期，突出工厂能力',
  globalsources: '环球资源：产品亮点 + 认证 + 产能 + 联系引导',
  whatsapp: 'WhatsApp：短消息，前两句说清来意与价值，结尾一个明确问题，不超过 500 字符',
  telegram: 'Telegram 频道：短段落 + 要点列表 + 链接，可带 emoji',
  email: '邮件：主题行 + 三段式正文（为什么联系你 / 能解决什么 / 下一步），结尾一个 CTA',
  mock: '通用社媒：钩子 + 价值 + CTA',
  webhook: '通用社媒：钩子 + 价值 + CTA',
};

on('POST', /^\/api\/content\/generate$/, async (m, b) => {
  const product = b.product_id ? get('select * from product where id = ?', Number(b.product_id)) : null;
  if (!product) throw new Error('product_id 必填且产品要存在');
  const hotspot = b.hotspot_id ? get('select * from hotspot where id = ?', Number(b.hotspot_id)) : null;
  const platforms = Array.isArray(b.platforms) && b.platforms.length ? b.platforms : ['facebook_page'];
  const lang = b.lang || setting('primary_lang') || 'en';
  const tone = b.tone || setting('brand_tone') || '专业';
  const structure = hotspot ? hotspot.structure : '{}';
  const utmBase = b.utm_url || product.url || 'https://packrivo.com';

  const made = [];
  const errors = [];
  let parentId = null;
  for (const platform of platforms) {
   try {
    const style = PLATFORM_STYLE[platform] || '通用社媒：钩子 + 价值 + CTA';
    /* 先由 kimi（监工）出内容简报：决定角度、钩子、结构与证据点，再交给执行模型写 */
  let brief = null;
  try {
    const briefPrompt = `你是外贸包装 B2B 内容总监。为下面这条 ${platform} 帖子定调，只输出 JSON。
产品：${product.name}（${product.sku}）
卖点：${product.selling_points || ''}
目标读者：欧美做首饰/蜡烛/礼品的小品牌创始人
${kbContext(1200)}
要求：给一个具体角度（不要泛泛而谈）、一句钩子、3-4 段结构、1-2 个可验证的证据点（只能来自卖点/知识库）、一句 CTA。
输出：{"angle":"...","hook":"...","structure":["..."],"proof":["..."],"cta":"..."}`;
    const br = await chat({ task: 'brief', messages: [{ role: 'user', content: briefPrompt }], temperature: 0.6, maxTokens: 800 });
    const objs = jsonObjectsIn(br.content).reverse();
    brief = objs.find((x) => x && (x.hook || x.angle)) || null;
    if (brief) audit('content.brief', String(product.id), { angle: brief.angle || '', via: br.via });
  } catch {}

  const LIMIT = platform === 'bluesky' ? '正文≤250 字符；加上链接和标签后必须 ≤300 字符（Bluesky 硬限制）'
    : platform === 'x' ? '正文≤240 字符'
    : platform === 'instagram' ? '正文≤1800 字符，前 125 字符要能独立成句'
    : platform === 'pinterest' ? '正文≤500 字符，用关键词句而不是长文'
    : '正文≤600 字符';
  const prompt = `你是外贸包装行业的社媒文案。按下面的产品资料与参考结构写一条${platform}帖子，语言=${lang}，语气=${tone}。
   字数要求：${LIMIT}
要求：
1. 借参考帖的「结构」，不要抄它的句子和图片，必须换成这个产品的具体信息。
2. 输出 JSON：{"title":"标题/开场钩子","body":"正文或脚本","hashtags":"空格分隔的标签, 不带#以外的符号","notes":"为什么这样写的一句话"}。
3. ${style}。
${brief ? `3.5 内容简报（必须照这个角度写）：角度=${brief.angle || ""}；钩子=${brief.hook || ""}；结构=${(brief.structure || []).join(" / ")}；证据点=${(brief.proof || []).join(" / ")}；CTA=${brief.cta || ""}` : ""}
4. 结尾必须引导到落地页：${utmBase}（不要编造折扣或认证）。

产品：${product.name}（SKU ${product.sku}）
卖点：${product.selling_points || '(未填写)'}
参数：${product.params || '(未填写)'}
目标市场：${product.target_markets || setting('market') || '欧美'}
关键词：${product.keywords || '(未填写)'}
${kbContext()}
参考爆款结构：${structure}`;

    let r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.8, maxTokens: 2600 });
    let obj = extractJson(r.content, ['body']);
    if (obj && looksLikeReasoning(obj.body)) {
      // 模型把思考过程当正文了，重试一次
      r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + '\n注意：正文必须是可直接发布的帖子，不要写任何"我需要/让我想想/输出 JSON"之类的话。' + JSON_RULE }], temperature: 0.6, maxTokens: 2600 });
      obj = extractJson(r.content, ['body']);
    }
    if (obj && looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截，请重试（这条不会入审核队列）');
    if (!obj) {
      const fix = await chat({
        task: 'rewrite',
        messages: [{ role: 'user', content: `把下面这段模型输出整理成 JSON，只输出一个对象 {"title","body","hashtags","notes"}，不要解释、不要代码块：\n\n${String(r.content).slice(0, 6000)}` }],
        temperature: 0.1,
        maxTokens: 2200,
      });
      obj = extractJson(fix.content, ['body']);
      r = fix;
    }
    if (!obj) obj = { title: '', body: '', hashtags: '', notes: '模型两次都没给出可解析的 JSON' };
    const slug = String(product.name).toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || product.sku.toLowerCase();
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const utm = `${utmBase}${utmBase.includes('?') ? '&' : '?'}utm_source=${platform}&utm_medium=social&utm_campaign=${slug}-${yymm}`;
    const sim = hotspot ? similarity(obj.body || '', `${hotspot.title} ${JSON.stringify(hotspot.structure)}`) : null;
    const ins = run(
      'insert into content(parent_id, product_id, hotspot_id, account_id, platform, lang, title, body, hashtags, utm_url, status, model, similarity) values (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      parentId, product.id, hotspot ? hotspot.id : null, b.account_id || null, platform, lang,
      obj.title || '', obj.body || '', obj.hashtags || '', utm, obj.body ? 'pending_review' : 'draft', r.model || '', sim
    );
    const id = Number(ins.lastInsertRowid);
    run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + id, id);
    run("update content set body = replace(replace(replace(body,'500 pcs/design','500 pcs per design'),'500pcs/design','500 pcs per design'),'MOQ 500 pcs per design per design','MOQ 500 pcs per design') where id = ?", id);
    run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), id);
    if (product.image_path) {
      run('update content set image_path = ?, image_alt = ? where id = ?', product.image_path, product.image_alt || product.name, id);
    }
    if (!parentId) { parentId = id; run('update content set parent_id = ? where id = ?', id, id); }
    made.push({ id, platform, similarity: sim, via: r.via, notes: obj.notes || '' });
   } catch (e) {
    errors.push({ platform, error: e.message });
   }
  }
  audit('content.generate', `product:${product.id}`, { count: made.length, hotspot: hotspot ? hotspot.id : null });
  const wantImage = b.gen_image === true || b.gen_image === '1';
  if (wantImage && made.length) runImageBatch(made.map((x) => x.id)).catch(() => {});
  return { ok: made.length > 0, created: made, errors, image_batch: wantImage };
});

on('GET', /^\/api\/contents$/, async (m, b) => {
  const where = [];
  const vals = [];
  const url = new URL(m.__url, 'http://x');
  const st = url.searchParams.get('status');
  if (st) { where.push('c.status = ?'); vals.push(st); }
  const sql = `select c.*, p.name as product_name, h.title as hotspot_title, a.handle as account_handle
               from content c left join product p on p.id = c.product_id
               left join hotspot h on h.id = c.hotspot_id
               left join account a on a.id = c.account_id
               ${where.length ? 'where ' + where.join(' and ') : ''} order by c.id desc limit 200`;
  return { contents: all(sql, ...vals) };
});

on('POST', /^\/api\/contents\/(\d+)\/review$/, async (m, b) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');
  const decision = b.decision === 'approve' ? 'approve' : 'reject';
  const kind = b.reviewer_kind || 'human';
  run('insert into review(content_id, reviewer_kind, decision, score, notes) values (?,?,?,?,?)', id, kind, decision, Number(b.score || 0), b.notes || '');
  if (decision === 'approve') run("update content set status = 'approved', approved_at = ? where id = ?", nowIso(), id);
  else run("update content set status = 'rejected' where id = ?", id);
  return { ok: true, status: decision === 'approve' ? 'approved' : 'rejected' };
});

on('POST', /^\/api\/contents\/(\d+)\/ai-review$/, async (m) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');
  const prompt = `你是外贸社媒内容审核。判断这条${c.platform}帖子能不能直接发布。只输出 JSON：
{"score":0-100,"decision":"approve|reject","issues":["问题1","问题2"],"reason":"一句话"}
${kbContext(2000)}
审核项：是否夸大或无依据的承诺、是否出现未经许可的品牌/认证、是否与参考帖过度相似、是否有拼写或语病、CTA 与落地页是否一致、平台字数与标签数量是否合规。
正文：${c.body}
标签：${c.hashtags}
标题：${c.title}`;
  const r = await chat({ task: 'review', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.2, maxTokens: 1600 });
  let obj = extractJson(r.content, ['score', 'decision']);
  let via = r.via;
  let applied = false;
  if (!obj) {
    // 审核模型可能只吐推理过程：换便宜模型做一次纯格式化修复
    const fix = await chat({
      task: 'review',
      model: 'deepseek-v4.1-flash',
      messages: [{ role: 'user', content: `把下面这段审核意见整理成 JSON，只输出 {"score":0-100,"decision":"approve|reject","issues":["..."],"reason":"一句话"}，不要解释：\n\n${String(r.content).slice(0, 4000)}` }],
      temperature: 0.1,
      maxTokens: 1600,
    });
    obj = extractJson(fix.content, ['score', 'decision']);
    via = fix.via + '（修复）';
  }
  if (!obj) obj = { score: 0, decision: 'reject', issues: ['模型未返回结构化结果'], reason: String(r.content).slice(0, 200) };
  if (looksLikeReasoning(c.body)) {
    const objLeak = { score: 0, decision: 'reject', issues: ['正文是模型思考过程，不是可发布的帖子'], reason: '自动拦截：检测到 reasoning 泄漏' };
    run('insert into review(content_id, reviewer_kind, decision, score, notes) values (?,?,?,?,?)', id, 'ai', 'reject', 0, JSON.stringify(objLeak));
    run("update content set status = 'rejected' where id = ?", id);
    return { ok: true, ai: objLeak, via: 'leak-guard', applied: false, forced_manual: false, sensitive_hits: [] };
  }
  const hits = sensitiveHits(`${c.title || ''}\n${c.body}\n${c.hashtags || ''}`);
  const forcedManual = hits.length > 0 && obj.decision === 'approve';
  run('insert into review(content_id, reviewer_kind, decision, score, notes) values (?,?,?,?,?)',
    id, 'ai', obj.decision === 'approve' ? 'approve' : 'reject', Number(obj.score || 0),
    JSON.stringify({ ...obj, sensitive_hits: hits }));
  if (obj.decision === 'approve' && !forcedManual && setting('publish_mode') === 'auto') {
    run("update content set status = 'approved', approved_at = ? where id = ?", nowIso(), id);
    applied = true;
  }
  if (forcedManual) {
    run("update content set status = 'pending_review' where id = ?", id);
    audit('review.forced_manual', `content:${id}`, { hits: hits.map((h) => h.label) });
  }
  return { ok: true, ai: obj, via, applied, sensitive_hits: hits, forced_manual: forcedManual };
});

on('GET', /^\/api\/reviews$/, async () => ({ reviews: all('select r.*, c.platform, c.title from review r join content c on c.id = r.content_id order by r.id desc limit 100') }));

on('POST', /^\/api\/contents$/, async (m, b) => {
  if (!b.platform || !b.body) throw new Error('platform 与 body 必填');
  const r = run(
    'insert into content(product_id, hotspot_id, account_id, platform, lang, title, body, hashtags, utm_url, status, model) values (?,?,?,?,?,?,?,?,?,?,?)',
    b.product_id || null, b.hotspot_id || null, b.account_id || null, b.platform, b.lang || 'en',
    b.title || '', b.body, b.hashtags || '', b.utm_url || '', b.status || 'pending_review', 'manual'
  );
  return { id: Number(r.lastInsertRowid) };
});

on('DELETE', /^\/api\/contents\/(\d+)$/, async (m) => {
  run('delete from content where id = ?', Number(m[1]));
  return { ok: true };
});

/* ---------- 排期与发布 ---------- */
on('GET', /^\/api\/schedules$/, async () => ({
  schedules: all(`select s.*, c.title, c.platform as content_platform, a.handle, a.platform as account_platform
                  from schedule s join content c on c.id = s.content_id join account a on a.id = s.account_id
                  order by s.id desc limit 200`),
}));

on('POST', /^\/api\/schedules$/, async (m, b) => {
  const content = get('select * from content where id = ?', Number(b.content_id));
  if (!content) throw new Error('内容不存在');
  const account = get('select * from account where id = ?', Number(b.account_id));
  if (!account) throw new Error('账号不存在');
  if (content.status === 'rejected') throw new Error('内容已被驳回，不能排期');
  const runAt = b.run_at ? String(b.run_at).replace('T', ' ').slice(0, 19) : nowIso();
  const r = run('insert into schedule(content_id, account_id, channel, run_at, state) values (?,?,?,?,?)',
    content.id, account.id, b.channel || 'auto', runAt, 'pending');
  audit('schedule.create', `content:${content.id}`, { run_at: runAt, channel: b.channel || 'auto' });
  return { id: Number(r.lastInsertRowid), run_at: runAt, content_status: content.status };
});

on('POST', /^\/api\/schedules\/(\d+)\/run-now$/, async (m) => {
  const id = Number(m[1]);
  run("update schedule set run_at = ?, state = 'pending' where id = ?", nowIso(), id);
  return { ok: true };
});

on('GET', /^\/api\/results$/, async () => ({
  results: all(`select r.*, c.title, c.body, c.image_path, c.hashtags, c.platform, c.utm_url,
    (select sum(m.likes) from metric m where m.content_id = c.id) as likes,
    (select sum(m.comments) from metric m where m.content_id = c.id) as replies,
    (select sum(m.shares) from metric m where m.content_id = c.id) as reposts
    from publish_result r left join content c on c.id = r.content_id order by r.id desc limit 200`),
}));

on('GET', /^\/api\/jobs$/, async () => ({ jobs: all('select * from job order by id desc limit 100') }));

on('POST', /^\/api\/tick$/, async () => tick());

on('GET', /^\/api\/channels$/, async () => ({ channels: await channelCatalog(), limits: all('select * from platform_limit order by platform') }));

/* ---------- Postiz 发布中心（公开 API v1） ---------- */
on('GET', /^\/api\/channels\/postiz$/, async () => postizStatus());

on('POST', /^\/api\/channels\/postiz\/key$/, async (m, b) => {
  const r = postizSaveKey(b.key);
  audit('postiz.key', '', { saved: r.saved, hint: r.hint });
  return r;
});

on('POST', /^\/api\/channels\/postiz\/verify$/, async () => {
  try {
    return await postizVerify();
  } catch (e) {
    return { ok: false, error_class: e.errorClass || 'exception', error: e.message, detail: e.detail || '' };
  }
});

/* 只建草稿（Postiz 里可见、不对外发），用来验证 settings 拼得对不对 */
on('POST', /^\/api\/channels\/postiz\/draft$/, async (m, b) => {
  const content = get('select * from content where id = ?', Number(b.content_id));
  if (!content) throw new Error('内容不存在');
  const account = get('select * from account where id = ?', Number(b.account_id));
  if (!account) throw new Error('账号不存在');
  const prev = setting('postiz_type');
  setSetting('postiz_type', 'draft');
  try {
    const r = await postizPublish({ content, account, platform: account.platform, schedule: null });
    audit('postiz.draft', `content:${content.id}`, { post_id: r.post_id, platform: account.platform });
    return r;
  } catch (e) {
    return { ok: false, error_class: e.errorClass || 'exception', error: e.message, detail: e.detail || '' };
  } finally {
    setSetting('postiz_type', prev || 'now');
  }
});


on('GET', /^\/api\/keywords$/, async () => {
  let list = [];
  try { list = JSON.parse(setting('seed_keywords') || '[]'); } catch {}
  return { keywords: list, source: 'packrivo 包装类种子词（设置 → seed_keywords 可编辑）' };
});

/* 视频生成：接口留好，加了「用途=视频」的接口就能调用（Q9 决策） */
on('GET', /^\/api\/video\/status$/, async () => {
  const eps = all("select id, name, base_url, model, priority from model_endpoint where kind = 'video' and enabled = 1 order by priority asc");
  return {
    ready: eps.length > 0,
    endpoints: eps,
    api_path: setting('video_api_path') || '/videos/generations',
    note: eps.length ? '接口已配置，可调用 /api/video/generate' : '在「模型接入」加一个用途=视频的接口后即可调用',
  };
});

on('POST', /^\/api\/video\/generate$/, async (m, b) => {
  const eps = all("select * from model_endpoint where kind = 'video' and enabled = 1 order by priority asc");
  if (!eps.length) return { ok: false, state: 'pending_config', reason: '未配置视频接口（模型接入页添加一个用途=视频的接口）' };
  const prompt = String(b.prompt || '').trim();
  if (!prompt) throw new Error('prompt 必填');
  const apiPath = setting('video_api_path') || '/videos/generations';
  const errs = [];
  for (const e of eps) {
    try {
      const r = await fetch(`${e.base_url.replace(/\/$/, '')}${apiPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(e.api_key_cipher ? { authorization: `Bearer ${decrypt(e.api_key_cipher)}` } : {}) },
        body: JSON.stringify({ model: e.model, prompt, ...(b.options || {}) }),
      });
      const text = await r.text();
      if (!r.ok) {
        errs.push(`${e.name}: HTTP ${r.status} ${text.slice(0, 200)}`);
        run('update model_endpoint set last_error = ? where id = ?', `HTTP ${r.status}`, e.id);
        continue;
      }
      let url = '';
      try {
        const j = JSON.parse(text);
        url = j.url || j.video_url || j.data?.[0]?.url || '';
      } catch {}
      run('update model_endpoint set last_ok_at = ?, last_error = ? where id = ?', nowIso(), '', e.id);
      if (b.content_id) {
        run('insert into asset(product_id, kind, path, tags, source) values ((select product_id from content where id = ?), ?, ?, ?, ?)',
          Number(b.content_id), 'video', url, 'ai-video', `endpoint:${e.name}`);
      }
      audit('video.generate', b.content_id ? `content:${b.content_id}` : '', { endpoint: e.name, url });
      return { ok: true, url, via: e.name, raw: text.slice(0, 400) };
    } catch (err) {
      errs.push(`${e.name}: ${err.message}`);
    }
  }
  return { ok: false, state: 'failed', errors: errs };
});

/* ---------- 知识库 ---------- */
on('GET', /^\/api\/kb$/, async () => ({
  items: all('select * from kb_item order by kind asc, weight desc, id asc'),
  kinds: KB_LABELS,
}));

on('POST', /^\/api\/kb$/, async (m, b) => {
  if (!b.title || !b.content) throw new Error('title 与 content 必填');
  const r = run('insert into kb_item(kind, title, content, tags, weight, enabled) values (?,?,?,?,?,?)',
    b.kind || 'brand', b.title, b.content, b.tags || '', Number(b.weight) || 50, b.enabled === false ? 0 : 1);
  audit('kb.create', `id:${r.lastInsertRowid}`, { kind: b.kind || 'brand' });
  return { id: Number(r.lastInsertRowid) };
});

on('PATCH', /^\/api\/kb\/(\d+)$/, async (m, b) => {
  const id = Number(m[1]);
  const sets = [];
  const vals = [];
  for (const f of ['kind', 'title', 'content', 'tags', 'weight', 'enabled']) if (f in b) { sets.push(`${f} = ?`); vals.push(b[f]); }
  if (!sets.length) return { ok: true };
  sets.push("updated_at = datetime('now')");
  run(`update kb_item set ${sets.join(', ')} where id = ?`, ...vals, id);
  return { ok: true };
});

on('DELETE', /^\/api\/kb\/(\d+)$/, async (m) => {
  run('delete from kb_item where id = ?', Number(m[1]));
  return { ok: true };
});

/* ---------- AI 分析（SEO / GEO / 为什么火） ---------- */
on('POST', /^\/api\/analyze$/, async (m, b) => {
  const kind = b.target_kind === 'hotspot' ? 'hotspot' : 'content';
  const id = Number(b.target_id);
  if (!id) throw new Error('target_id 必填');
  const mode = b.mode || (kind === 'content' ? 'seo_geo' : 'why');
  let prompt = '';
  if (kind === 'content') {
    const ct = get('select * from content where id = ?', id);
    if (!ct) throw new Error('内容不存在');
    const p = ct.product_id ? get('select * from product where id = ?', ct.product_id) : null;
    prompt = `你是外贸独立站的 SEO 与 GEO 优化师。分析下面这条 ${ct.platform} 帖子，只输出 JSON：
{"seo":{"score":0-100,"issues":["..."],"fixes":["..."]},"geo":{"score":0-100,"issues":["..."],"fixes":["..."]},"keywords":["3-5 个建议主打的英文关键词"],"optimized_title":"改好的标题","optimized_points":["3-5 条可直接照改的点"]}

SEO 看：关键词是否自然出现在标题与首句、标签数量与相关性、CTA 是否指向落地页、是否命中采购意图词。
GEO（生成式引擎优化）看：实体是否明确（品牌/产品/材质/规格）、有没有能被 AI 直接摘走的结论句、事实与数据密度、是否分点、是否回答了买家会问的具体问题、规格是否可核验。

${kbContext(2500)}
产品：${p ? p.name + ' / ' + (p.selling_points || '') : '(未关联)'}
平台：${ct.platform}
标题：${ct.title}
正文：${ct.body}
标签：${ct.hashtags}
落地页：${ct.utm_url}`;
  } else {
    const h = get('select * from hotspot where id = ?', id);
    if (!h) throw new Error('爆款不存在');
    prompt = `你是外贸社媒内容分析师。分析这条 ${h.platform} 参考内容，只输出 JSON：
{"why":[{"point":"为什么它能火","evidence":"依据"}],"audience":"它打的是什么人","reusable":["可直接套到包装 B2B 的结构点"],"risks":["照搬会踩的坑"],"seo":{"keywords":["这条内容天然覆盖的关键词"]},"geo":{"answerable_questions":["买家用 AI 搜索会问的 3 个问题"]}}

标题：${h.title}
作者：${h.author}
数据：${h.stats}
摘要：${(h.snippet || '').slice(0, 400)}
已有结构：${h.structure}`;
  }
  const need = kind === 'content' ? ['seo', 'geo'] : ['why'];
  const r = await chat({ task: 'analyze', model: b.model || '', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.3, maxTokens: 2600 });
  let obj = extractJson(r.content, need);
  if (!obj) {
    const fix = await chat({
      task: 'analyze',
      model: 'space-bunny',
      messages: [{ role: 'user', content: `把下面内容整理成 JSON，只输出对象，不要解释：\n\n${String(r.content).slice(0, 5000)}` }],
      temperature: 0.1,
      maxTokens: 2200,
    });
    obj = extractJson(fix.content, need);
  }
  if (!obj) throw new Error('模型没有返回可解析的分析结果');
  const ins = run('insert into ai_analysis(target_kind, target_id, mode, payload, model) values (?,?,?,?,?)', kind, id, mode, JSON.stringify(obj), r.model || '');
  audit('analyze.run', `${kind}:${id}`, { mode });
  return { ok: true, id: Number(ins.lastInsertRowid), mode, analysis: obj, via: r.via };
});

on('GET', /^\/api\/analyze$/, async (m) => {
  const u = new URL(m.__url, 'http://x');
  const kind = u.searchParams.get('target_kind');
  const id = Number(u.searchParams.get('target_id'));
  if (!kind || !id) throw new Error('target_kind 与 target_id 必填');
  const rows = all('select * from ai_analysis where target_kind = ? and target_id = ? order by id desc limit 20', kind, id);
  return { analyses: rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })) };
});
/* ---------- 工作区（类目） ---------- */
function workspace() {
  let comps = [];
  try { comps = JSON.parse(setting('competitors') || '[]'); } catch {}
  return {
    ready: setting('profile_ready') === '1',
    category: setting('category') || '',
    sub_niches: setting('sub_niches') || '',
    markets: setting('markets') || '',
    brand_name: setting('brand_name') || '',
    brand_site: setting('brand_site') || '',
    competitors: comps,
    primary_lang: setting('primary_lang') || 'en',
    brand_tone: setting('brand_tone') || '',
  };
}

on('GET', /^\/api\/workspace$/, async () => ({ profile: workspace() }));

on('PUT', /^\/api\/workspace$/, async (m, b) => {
  const map = { category: 'category', sub_niches: 'sub_niches', markets: 'markets', brand_name: 'brand_name', brand_site: 'brand_site', primary_lang: 'primary_lang', brand_tone: 'brand_tone' };
  for (const [k, sk] of Object.entries(map)) if (k in b) setSetting(sk, b[k]);
  if (Array.isArray(b.competitors)) setSetting('competitors', JSON.stringify(b.competitors.map((s) => String(s).trim()).filter(Boolean)));
  if (Array.isArray(b.keywords) && b.keywords.length) setSetting('seed_keywords', JSON.stringify(b.keywords.map((s) => String(s).trim()).filter(Boolean)));
  setSetting('profile_ready', b.ready === false ? '0' : '1');
  audit('workspace.update', '', { category: b.category || '' });
  return { ok: true, profile: workspace() };
});

/* ---------- 情报雷达 ---------- */
on('GET', /^\/api\/radar$/, async () => {
  const row = get('select * from radar_snapshot where id = 1');
  if (!row) return { radar: null, profile: workspace() };
  let payload = null;
  try { payload = JSON.parse(row.payload); } catch {}
  return { radar: payload, fetched_at: row.fetched_at, profile: workspace() };
});

const radarJob = { running: false, stage: '', started_at: '', finished_at: '', error: '', result: null };

on('GET', /^\/api\/radar\/refresh$/, async () => ({
  running: radarJob.running,
  stage: radarJob.stage,
  started_at: radarJob.started_at,
  finished_at: radarJob.finished_at,
  error: radarJob.error,
  counts: radarJob.result
    ? { videos: radarJob.result.videos.length, posts: radarJob.result.posts.length, articles: radarJob.result.articles.length, products: radarJob.result.products.length, keywords: radarJob.result.keywords.length }
    : null,
}));

on('POST', /^\/api\/radar\/refresh$/, async (m, b) => {
  if (radarJob.running) return { started: false, reason: '上一轮还在抓', stage: radarJob.stage };
  const p = workspace();
  const category = String(b.category || p.category || '').trim();
  if (!category) throw new Error('先填类目（设置页或首次引导）');
  let keywords = [];
  try { keywords = JSON.parse(setting('seed_keywords') || '[]'); } catch {}
  if (Array.isArray(b.keywords) && b.keywords.length) keywords = b.keywords;
  const competitors = Array.isArray(b.competitors) && b.competitors.length ? b.competitors : p.competitors;

  radarJob.running = true; radarJob.stage = '准备'; radarJob.started_at = nowIso(); radarJob.finished_at = ''; radarJob.error = ''; radarJob.result = null;

  const job = (async () => {
  const radar = await buildRadar({
    category,
    keywords: keywords.slice(0, 5),
    competitors,
    market: String(b.market || p.markets || 'us').slice(0, 2).toLowerCase() === 'us' ? 'us' : 'us',
    videosPer: Number(b.videos_per) || 4,
    onStage: (st) => { radarJob.stage = st; },
  });
  run('insert into radar_snapshot(id, payload, fetched_at) values (1, ?, ?) on conflict(id) do update set payload = excluded.payload, fetched_at = excluded.fetched_at',
    JSON.stringify(radar), radar.generated_at);
  for (const it of [...(radar.videos || []), ...(radar.posts || []), ...(radar.articles || [])]) {
    if (it && it.url) run('insert or ignore into radar_seen(url) values (?)', it.url);
  }
  audit('radar.refresh', '', { videos: radar.videos.length, articles: radar.articles.length, sites: radar.competitors.length });
  radarJob.result = radar;
  return radar;
  })().catch((e) => { radarJob.error = String(e && e.message || e); }).finally(() => { radarJob.running = false; radarJob.stage = ''; radarJob.finished_at = nowIso(); });

  job.catch(() => {});
  return { started: true, stage: radarJob.stage };
});

on('POST', /^\/api\/radar\/competitor$/, async (m, b) => {
  const domain = String(b.domain || '').trim();
  if (!domain) throw new Error('域名必填');
  const info = await probeCompetitor(domain);
  let comps = [];
  try { comps = JSON.parse(setting('competitors') || '[]'); } catch {}
  if (!comps.includes(info.domain)) comps.push(info.domain);
  setSetting('competitors', JSON.stringify(comps));
  audit('radar.competitor', info.domain, { platform: info.platform });
  return { ok: true, competitor: info, competitors: comps };
});

on('DELETE', /^\/api\/radar\/competitor\/(.+)$/, async (m) => {
  const domain = decodeURIComponent(m[1]);
  let comps = [];
  try { comps = JSON.parse(setting('competitors') || '[]'); } catch {}
  comps = comps.filter((d) => d !== domain);
  setSetting('competitors', JSON.stringify(comps));
  return { ok: true, competitors: comps };
});

on('POST', /^\/api\/radar\/reroll$/, async (m, b) => {
  const scope = ['videos', 'posts', 'articles', 'products'].includes(b.scope) ? b.scope : 'videos';
  const row = get('select * from radar_snapshot where id = 1');
  if (!row) throw new Error('还没有情报快照，先点「刷新情报」');
  let snap;
  try { snap = JSON.parse(row.payload); } catch { throw new Error('快照损坏，请重新刷新'); }
  const exclude = new Set(all('select url from radar_seen').map((r) => r.url));
  const seeds = (snap.seeds && snap.seeds.length ? snap.seeds : [snap.category]).filter(Boolean);
  const batch = await buildItems({ category: snap.category, seeds, exclude, per: 8 });
  let fresh = batch[scope] || [];
  let audit_error = '';
  const usedFallback = fresh.length === 0;

  // 换一批也要过 kimi，别把跑题的塞回去
  if (fresh.length) {
    try {
      let ca = await auditContent({
        category: snap.category,
        videos: scope === 'videos' ? fresh : [],
        posts: scope === 'posts' ? fresh : [],
        articles: scope === 'articles' ? fresh : [],
      });
      if (!ca.items || !ca.items.length) ca = await auditContent({ category: snap.category, videos: scope === 'videos' ? fresh : [], posts: scope === 'posts' ? fresh : [], articles: scope === 'articles' ? fresh : [] });
      const map = new Map((ca.items || []).map((x) => [x.id, x]));
      const prefix = scope === 'videos' ? 'v' : scope === 'posts' ? 'p' : scope === 'products' ? 'g' : 'a';
      fresh = fresh.map((x, i) => {
        const a = map.get(prefix + i);
        return a ? { ...x, ai: { score: a.score, verdict: a.verdict, reason: a.reason } } : x;
      });
    } catch (e) { audit_error = e.message; }
  }
  if (!usedFallback) snap[scope] = fresh;
  snap.batch = (snap.batch || 0) + 1;
  snap.reroll_at = nowIso();
  run('update radar_snapshot set payload = ? where id = 1', JSON.stringify(snap));
  for (const it of fresh) if (it.url) run('insert or ignore into radar_seen(url) values (?)', it.url);
  audit('radar.reroll', scope, { count: fresh.length, fallback: usedFallback });
  return { ok: true, scope, count: fresh.length, fallback: usedFallback, audit_error, errors: batch.errors };
});

on('POST', /^\/api\/radar\/suggest$/, async (m, b) => {
  const seed = String(b.seed || '').trim();
  if (!seed) throw new Error('seed 必填');
  return { ok: true, seed, suggestions: await suggest(seed, String(b.market || 'us').slice(0, 2)) };
});
/* ---------- 关键词找爆款 ---------- */
on('GET', /^\/api\/discover\/sources$/, async () => {
  const ready = !!(setting('apify_token') && setting('apify_actor'));
  return {
    sources: Object.entries(SOURCES).map(([key, v]) => ({ key, ...v, configured: key === 'apify' ? ready : true })),
    apify_ready: ready,
  };
});

on('POST', /^\/api\/discover$/, async (m, b) => {
  const keywords = (b.keywords || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
  if (!keywords.length) throw new Error('至少给一个关键词');
  const sources = (b.sources || ['youtube', 'gnews']).filter((s) => s in SOURCES);
  if (!sources.length) throw new Error('至少选一个来源');
  const per = Math.min(10, Math.max(1, Number(b.per) || 5));
  const minScore = Number(b.min_score) || 0;
  const r = await discover({
    keywords, sources, per, minScore,
    apify: { token: setting('apify_token') || '', actor: setting('apify_actor') || '' },
  });
  audit('discover.run', '', { keywords, sources, found: r.items.length });
  return { ok: true, count: r.items.length, items: r.items, errors: r.errors, keywords, sources };
});

on('POST', /^\/api\/hotspots\/bulk$/, async (m, b) => {
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new Error('没有选中条目');
  if (items.length > 60) throw new Error('一次最多入库 60 条');
  const ids = [];
  for (const it of items) {
    const stats = typeof it.stats === 'string' ? it.stats : JSON.stringify(it.stats || {});
    const r = run(
      'insert into hotspot(platform, kind, keyword, url, author, title, published, snippet, stats, score, score_type, source) values (?,?,?,?,?,?,?,?,?,?,?,?)',
      it.platform || 'article', it.kind || 'post', it.keyword || '', it.url || '', it.author || '', it.title || '',
      it.published || '', it.snippet || '', stats, Number(it.score) || 0, it.score_type || 'manual', it.source || 'discover'
    );
    ids.push(Number(r.lastInsertRowid));
  }
  audit('hotspot.bulk', '', { count: ids.length, first_id: ids[0] });
  return { ok: true, ids, count: ids.length };
});
/* 阿里巴巴人机验证：开一个有头窗口，用户自己拖一次滑块，cookie 存进 profile 后复用 */
on('POST', /^\/api\/products\/warmup$/, async (m, b) => {
  const keyword = String(b.keyword || 'jewelry gift box');
  const r = await warmupAlibaba(keyword);
  audit('alibaba.warmup', keyword, r);
  return r;
});

/* 按 AI 分析建议重写：生成新版本（parent_id 指向原稿），原文保留 */
on('POST', /^\/api\/contents\/(\d+)\/rewrite-from-analysis$/, async (m) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');

  const row = get("select payload from ai_analysis where target_kind = 'content' and target_id = ? order by id desc limit 1", id);
  if (!row) throw new Error('这条还没做过 AI 分析，先点「AI 分析」');
  let a = {};
  try { a = JSON.parse(row.payload); } catch {}

  const issues = [...(a.seo?.issues || []), ...(a.geo?.issues || [])].slice(0, 10);
  const fixes = [...(a.seo?.fixes || []), ...(a.geo?.fixes || [])].slice(0, 10);
  const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;
  const policy = get('select * from platform_tag_policy where platform = ?', c.platform) || { text_limit: 600 };
  const limit = Math.min(250, policy.text_limit || 600);

  const shortIssues = issues.slice(0, 2).map((x) => String(x).slice(0, 90));
  const prompt = `Rewrite this ${c.platform} post. Fix these problems:
${shortIssues.map((x, k) => (k + 1) + '. ' + x).join('\n') || '- tighten the opening'}

Original post:
${String(c.body || '').slice(0, 500)}

Rules: keep the same facts; do not invent price, lead time, certificates or client cases; MOQ only as "500 pcs per design"; body <= 180 characters; no URL in the body; ${product ? 'product is ' + product.name + ' (SKU ' + product.sku + ');' : ''} brand is Packrivo, a Shenzhen-based packaging sourcing coordinator (not a factory).
Output the JSON object only, no reasoning, no explanation.
{"title":"one-line hook","body":"<=180 chars","hashtags":"3 tags"}`;

  let obj = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await chat({
      task: 'analyze',
      messages: [{ role: 'user', content: prompt + '\n只输出 JSON，不要任何解释。' + JSON_RULE }],
      temperature: attempt === 0 ? 0.7 : 0.5,
      maxTokens: 700,
    });
    audit('rewrite.debug', String(id), { len: String(r.content || '').length, raw: String(r.content || '').slice(0, 600) });
    const candidates = [...jsonObjectsIn(r.content)].reverse();
    const o = candidates.find((x) => x && x.body && String(x.body).trim() && !looksLikeReasoning(x.body))
      || extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }
    // 兜底：模型没给 JSON 就整段当正文，只要不像思考过程
    const raw = String(r.content || '').replace(/^\s*\{?[\s\S]*?"body"\s*:\s*"?/i, '').trim();
    if (attempt === 2 && raw.length > 40 && !looksLikeReasoning(raw)) {
      obj = { title: c.title, body: raw.replace(/[\"}]\s*$/,'').slice(0, 600), hashtags: c.hashtags };
      break;
    }
  }
  if (!obj) {
    try {
      const r2 = await chat({ task: 'analyze', messages: [{ role: 'user', content: prompt }], temperature: 0.5, maxTokens: 900 });
      const o2 = extractJson(r2.content, ['body']);
      if (o2 && o2.body && !looksLikeReasoning(o2.body)) obj = o2;
    } catch {}
  }
  if (!obj) throw new Error('模型没给出可用正文（可能触发了质检），稍后重试');

  const ins = run(
    'insert into content(product_id, parent_id, platform, lang, title, body, hashtags, status, model) values (?,?,?,?,?,?,?,?,?)',
    c.product_id, c.id, c.platform, c.lang, obj.title || c.title, obj.body, pickTags(c.platform, obj.hashtags || ''), 'pending_review', 'rewrite-by-analysis'
  );
  const newId = Number(ins.lastInsertRowid);
  if (product && product.image_path) {
    run('update content set image_path = ?, image_alt = ? where id = ?', product.image_path, product.image_alt || product.name, newId);
  }
  audit('content.rewrite', String(id), { new_id: newId, issues: issues.length });
  return { ok: true, id: newId, title: obj.title, body: obj.body, chars: String(obj.body).length, issues: issues.length };
});

/* ---------- 本地出图（ComfyUI） ---------- */
on('GET', /^\/api\/image\/status$/, async () => {
  const st = await comfyStatus();
  const ckpts = st.ok ? await listCheckpoints() : [];
  const api = imageApiCfg();
  const backup = imageApiBackupCfg();
  const fallback = imageApiFallbackCfg();
  const sd = await sdServiceStatus();
  return { ...st, checkpoints: ckpts, sd_service: sd, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' }, backup: { configured: !!backup, model: backup ? backup.model : '' }, fallback: { configured: !!fallback, model: fallback ? fallback.model : '' } };
});

/* 外部图像 API 配置（OpenAI 兼容 /images/generations） */
function imageApiCfg() {
  const base = String(setting('image_api_base') || '').trim().replace(/\/$/, '');
  const key = String(setting('image_api_key') || '').trim();
  const model = String(setting('image_api_model') || '').trim() || 'gpt-image-2';
  if (!base || !key) return null;
  return { base, key, model };
}

/* 第三通道（兜底，前两条都失败才用） */
function imageApiFallbackCfg() {
  const base = String(setting('image_api_fallback_base') || '').trim().replace(/\/$/, '');
  const key = String(setting('image_api_fallback_key') || '').trim();
  const model = String(setting('image_api_fallback_model') || '').trim() || 'gemini-nano-banana-2.1';
  if (!base || !key) return null;
  return { base, key, model, asyncMode: true };
}

/* 备用通道（第二个 Key / 第二个站） */
function imageApiBackupCfg() {
  const base = String(setting('image_api_backup_base') || setting('image_api_base') || '').trim().replace(/\/$/, '');
  const key = String(setting('image_api_backup_key') || '').trim();
  const model = String(setting('image_api_backup_model') || '').trim() || 'gpt-image-2.5';
  if (!base || !key) return null;
  return { base, key, model };
}

function imageEndpoints() {
  return [imageApiCfg(), imageApiBackupCfg(), imageApiFallbackCfg()].filter(Boolean);
}

async function generateImageExternal({ prompt, size = '1024x1024', ratio = '4:5' }) {
  const list = imageEndpoints();
  const errors = [];
  for (const cfg of list) {
    try {
      return await generateImageWith(cfg, { prompt, size, ratio });
    } catch (e) {
      errors.push((cfg.model || '') + ': ' + String(e.message).slice(0, 120));
    }
  }
  throw new Error('所有图像通道都失败 → ' + errors.join(' | '));
}

async function generateImageWith(cfg, { prompt, size = '1024x1024', ratio = '4:5' }) {
  const isRatioModel = /nano-banana|gemini|seedream|flux/i.test(cfg.model);
  const sizeArg = isRatioModel ? ratio : size;

  let r = null;
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await fetch(cfg.base + '/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: sizeArg }),
      signal: AbortSignal.timeout(180000),
    });
    text = await r.text();
    if (r.ok) break;
    if (r.status === 503 && attempt < 2) { await new Promise((res) => setTimeout(res, 4000)); continue; }
    break;
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + text.slice(0, 200));

  const j = JSON.parse(text);
  const first = j.data?.[0] || j;

  /* 异步任务：先拿 task_id，再轮询 /tasks/{id} */
  const taskId = first.task_id || first.id;
  if (taskId && (first.status === 'submitted' || first.status === 'processing' || !first.b64_json && !first.url)) {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 3000));
      const pr = await fetch(cfg.base + '/tasks/' + taskId, { headers: { authorization: 'Bearer ' + cfg.key }, signal: AbortSignal.timeout(30000) });
      if (!pr.ok) continue;
      const pj = await pr.json();
      const d = pj.data || pj;
      if (d.status === 'failed' || d.status === 'error') throw new Error('任务失败：' + JSON.stringify(d).slice(0, 160));
      if (d.status !== 'completed') continue;
      const raw = d.result?.images?.[0]?.url || d.result?.images?.[0] || d.result?.url;
      const imgUrl = Array.isArray(raw) ? raw[0] : raw;
      if (!imgUrl) throw new Error('任务完成但没有图片地址');
      const img = await fetch(imgUrl, { signal: AbortSignal.timeout(90000) });
      if (!img.ok) throw new Error('下载图片失败 ' + img.status);
      const buf = Buffer.from(await img.arrayBuffer());
      const { writeFileSync: wf, mkdirSync } = await import('node:fs');
      const { join } = await import('node:path');
      const dir = MEDIA_DIR;
      mkdirSync(dir, { recursive: true });
      const name = 'api-' + Date.now() + '.jpg';
      wf(join(dir, name), buf);
      return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: '', height: '', bytes: buf.length };
    }
    throw new Error('任务超时（240s）');
  }

  const b64 = j.data?.[0]?.b64_json || (j.data?.[0]?.url ? null : null);
  if (b64) {
    const { writeFileSync: wf, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = MEDIA_DIR;
    mkdirSync(dir, { recursive: true });
    const name = 'api-' + Date.now() + '.png';
    wf(join(dir, name), Buffer.from(b64, 'base64'));
    return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: size.split('x')[0], height: size.split('x')[1], bytes: Buffer.from(b64, 'base64').length };
  }
  const imgUrl = j.data?.[0]?.url;
  if (imgUrl) {
    const img = await fetch(imgUrl, { signal: AbortSignal.timeout(60000) });
    const buf = Buffer.from(await img.arrayBuffer());
    const { writeFileSync: wf, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = MEDIA_DIR;
    mkdirSync(dir, { recursive: true });
    const name = 'api-' + Date.now() + '.png';
    wf(join(dir, name), buf);
    return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: '', height: '', bytes: buf.length };
  }
  throw new Error('外部图像 API 没返回图片');
}

on('POST', /^\/api\/contents\/(\d+)\/generate-image$/, async (m, b) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');
  const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;

  /* 1) 已有提示词就用，没有就让模型写一段 */
  let prompt = '';
  let negative = '';
  let ratio = b.ratio || '4:5';
  if (c.image_prompt) {
    try {
      const o = JSON.parse(c.image_prompt);
      prompt = o.prompt || '';
      negative = o.negative || '';
      ratio = o.ratio || ratio;
    } catch {}
  }
  if (!prompt) {
    const ask = `Write one English image prompt (60-90 words) for a commercial product photo used with this post. No text in the image.
Post: ${c.title || ''} ${String(c.body || '').slice(0, 300)}
${product ? 'Product: ' + product.name + ' — ' + (product.selling_points || '') : ''}
Style: clean studio, soft natural light, neutral background, jewelry/candle/gift packaging context, negative space for copy, vertical ${ratio}.
Output JSON only: {"prompt":"...","negative":"..."}`;
    const r = await chat({ task: 'analyze', model: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });
    const objs = jsonObjectsIn(r.content).reverse();
    const o = objs.find((x) => x && x.prompt) || {};
    prompt = o.prompt || ('commercial product photography of ' + (product?.name || 'custom packaging') + ', clean studio, soft light, no text');
    negative = o.negative || '';
  }

  const [w, h] = ratio.split(':').map(Number);
  const base = 640;
  const snap = (v) => Math.max(512, Math.round(v / 64) * 64);   // SD 要求 8 的倍数，取 64 对齐
  const width = w && h ? snap(base * (w / Math.max(w, h))) : 832;
  const height = w && h ? snap(base * (h / Math.max(w, h))) : 1024;

  let out;
  const sd = await sdServiceStatus();
  if (!imageApiCfg() && sd.ok) {
    out = await sdServiceGenerate({ prompt, negative, width, height });
  } else if (imageApiCfg()) {
    out = await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height), ratio });
  } else {
    out = await generateImage({ prompt, negative, width, height });
  }
  run('update content set image_path = ?, image_alt = ? where id = ?', out.file, prompt.slice(0, 300), id);
  audit('content.generate_image', String(id), { model: out.model, bytes: out.bytes });
  return { ok: true, url: out.url, file: out.file, model: out.model, width: out.width, height: out.height, prompt };
});

/* ---------- 批量配图 ---------- */
const imageBatch = { running: false, total: 0, done: 0, ok: 0, failed: 0, current: '', results: [], errors: [], started_at: '', finished_at: '' };

async function runImageBatch(ids) {
  imageBatch.running = true;
  imageBatch.total = ids.length;
  imageBatch.done = 0;
  imageBatch.ok = 0;
  imageBatch.failed = 0;
  imageBatch.results = [];
  imageBatch.errors = [];
  imageBatch.started_at = nowIso();
  imageBatch.finished_at = '';

  for (const id of ids) {
    imageBatch.current = '#' + id;
    try {
      const c = get('select * from content where id = ?', id);
      if (!c) throw new Error('内容不存在');
      const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;

      let prompt = '';
      let negative = '';
      let ratio = '4:5';
      if (c.image_prompt) {
        try {
          const o = JSON.parse(c.image_prompt);
          prompt = o.prompt || '';
          negative = o.negative || '';
          ratio = o.ratio || ratio;
        } catch {}
      }
      if (!prompt) {
        const ask = `Write one English image prompt (60-90 words) for a commercial product photo used with this post. No text in the image.
Post: ${c.title || ''} ${String(c.body || '').slice(0, 300)}
${product ? 'Product: ' + product.name + ' — ' + (product.selling_points || '') : ''}
Style: clean studio, soft natural light, neutral background, jewelry/candle/gift packaging context, negative space for copy, vertical ${ratio}.
Output JSON only: {"prompt":"...","negative":"..."}`;
        const r = await chat({ task: 'analyze', model: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });
        const o = jsonObjectsIn(r.content).reverse().find((x) => x && x.prompt) || {};
        prompt = o.prompt || ('commercial product photography of ' + (product?.name || 'custom packaging') + ', clean studio, soft light, no text');
        negative = o.negative || '';
      }

      const [w, h] = ratio.split(':').map(Number);
      const base = 640;
      const width = w && h ? Math.round(base * (w / Math.max(w, h))) : 832;
      const height = w && h ? Math.round(base * (h / Math.max(w, h))) : 1024;

      const cfg = imageApiCfg();
      const sd = await sdServiceStatus();
      const out = cfg
        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height), ratio })
        : (sd.ok ? await sdServiceGenerate({ prompt, negative, width, height }) : await generateImage({ prompt, negative, width, height }));

      run('update content set image_path = ?, image_alt = ?, image_prompt = ? where id = ?',
        out.file, prompt.slice(0, 300), JSON.stringify({ prompt, negative, ratio }), id);
      imageBatch.ok++;
      imageBatch.results.push({ id, url: out.url, model: out.model });
    } catch (e) {
      imageBatch.failed++;
      imageBatch.errors.push({ id, error: e.message });
    }
    imageBatch.done++;
  }
  imageBatch.running = false;
  imageBatch.current = '';
  imageBatch.finished_at = nowIso();
  audit('content.batch_image', String(ids.length), { ok: imageBatch.ok, failed: imageBatch.failed });
}

on('POST', /^\/api\/images\/batch$/, async (m, b) => {
  if (imageBatch.running) return { started: false, reason: '上一批还在跑', progress: imageBatch };
  const limit = Math.min(Number(b.limit) || 10, 20);
  const rows = b.ids
    ? all(`select id from content where id in (${b.ids.map(() => '?').join(',')})`, ...b.ids.map(Number))
    : all("select id from content where status in ('pending_review','approved','draft') and (image_path is null or image_path = '') order by id desc limit ?", limit);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { started: false, reason: '没有需要出图的稿子' };
  runImageBatch(ids).catch(() => {});
  return { started: true, total: ids.length, ids };
});

on('GET', /^\/api\/images\/batch$/, async () => imageBatch);

/* ---------- 配图提示词（本机未接图像模型，先产出可直接粘贴的英文 prompt） ---------- */
on('POST', /^\/api\/contents\/(\d+)\/image-prompt$/, async (m, b) => {
  const id = Number(m[1]);
  const c = get('select c.*, p.name as pname, p.selling_points as ppoints from content c left join product p on p.id = c.product_id where c.id = ?', id);
  if (!c) throw new Error('内容不存在');
  const ratio = b.ratio || '4:5';
  const prompt = `为这条 ${c.platform} 帖子写一段英文出图提示词（给 Midjourney / SD / 即梦用）。
帖子标题：${c.title}
正文：${String(c.body || '').slice(0, 600)}
产品：${c.pname || '(未关联)'} ${String(c.ppoints || '').slice(0, 200)}
要求：商业产品摄影，首饰/蜡烛/礼盒场景，干净背景，自然光，无文字、无 logo、无水印，画面留出放文案的空间，比例 ${ratio}。
输出 JSON：{"prompt":"英文提示词，逗号分隔，60-90词","negative":"英文反向词","ratio":"${ratio}","alt":"一句中文说明这张图要表达什么"}`;
  const r = await chat({ task: 'analyze', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.6, maxTokens: 1000 });
  const obj = extractJson(r.content, ['prompt']) || { prompt: String(r.content || '').slice(0, 600), negative: '', ratio, alt: '' };
  run('update content set image_prompt = ? where id = ?', JSON.stringify(obj), id);
  audit('content.image_prompt', String(id), { ratio });
  return { ok: true, ...obj };
});

/* ---------- 博客转社媒 ---------- */
on('POST', /^\/api\/blog\/import$/, async (m, b) => {
  const url = String(b.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('请填写完整博客链接（含 https://）');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: ac.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('博客打不开：HTTP ' + r.status);
    html = await r.text();
  } catch (e) {
    throw new Error('读取博客失败：' + e.message);
  } finally { clearTimeout(timer); }

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '--', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...' };
  const decodeEnt = (t) => String(t || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
  const strip = (x) => decodeEnt(String(x || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const title = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') || 'Blog post';
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((x) => strip(x[1])).filter(Boolean).slice(0, 8);
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => strip(x[1])).filter((x) => x.length > 60).slice(0, 6);

  const platforms = (Array.isArray(b.platforms) && b.platforms.length ? b.platforms : ['facebook_page', 'instagram', 'linkedin']).slice(0, 5);
  const product = b.product_id ? get('select * from product where id = ?', Number(b.product_id)) : get('select * from product order by id desc limit 1');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'blog';
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');

  const made = [];
  const errors = [];
  for (const platform of platforms) {
    try {
      const prompt = `把下面这篇博客改写成一条 ${platform} 帖子。语言=英文，语气=专业。
要求：借用文章的要点与顺序，不要整段照抄；不得编造价格、折扣、交期、认证、客户案例或电话；MOQ 只能写 "500 pcs per design"。
${kbContext(2500)}
博客标题：${title}
小标题：${h2s.join(' | ')}
要点：${paras.join(' ')}
关联产品：${product ? product.name + '（' + (product.selling_points || '') + '）' : '(无)'}
平台文体：${PLATFORM_STYLE[platform] || '通用社媒'}
输出 JSON：{"title":"...","body":"...","hashtags":"..."}`;
      let r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2400 });
      let obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };
      if (looksLikeReasoning(obj.body)) {
        r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + '\n注意：只写可以直接发布的帖子正文，不要出现“我需要/让我想想/输出 JSON”这类思考过程。' + JSON_RULE }], temperature: 0.5, maxTokens: 2400 });
        obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };
      }
      if (looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截');
      const utm = `${url}${url.includes('?') ? '&' : '?'}utm_source=${platform}&utm_medium=social&utm_campaign=${slug}-${yymm}`;
      const ins = run(
        'insert into content(product_id, platform, lang, title, body, hashtags, utm_url, status, model) values (?,?,?,?,?,?,?,?,?)',
        product ? product.id : null, platform, 'en', obj.title || title, obj.body || '', obj.hashtags || '', utm, 'pending_review', r.model || ''
      );
      const newId = Number(ins.lastInsertRowid);
      run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + newId, newId);
      run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), newId);
      made.push({ id: newId, platform });
    } catch (e) {
      errors.push({ platform, error: e.message });
    }
  }
  audit('blog.import', url, { created: made.length });
  return { ok: made.length > 0, source: { url, title, headings: h2s, paragraphs: paras.length }, created: made, errors };
});

/* ---------- 话题标签池 ---------- */
function pickTags(platform, extra = '') {
  const policy = get('select * from platform_tag_policy where platform = ?', platform)
    || { min_tags: 2, max_tags: 5, layer_quota: '{"broad":1,"niche":2,"audience":1}', tag_style: 'hashtag' };
  let quota = { broad: 1, niche: 2, audience: 1 };
  try { quota = JSON.parse(policy.layer_quota); } catch {}

  const rows = all('select tag, tier, weight from hashtag where platform = ?', platform);
  const by = { broad: [], niche: [], audience: [] };
  for (const r of rows) (by[r.tier] || by.niche).push(r);

  const pick = (arr, n) => {
    const pool = [...arr];
    const out = [];
    while (pool.length && out.length < n) {
      const total = pool.reduce((a, x) => a + (x.weight || 50), 0);
      let t = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) { t -= pool[idx].weight || 50; if (t <= 0) break; }
      out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
    }
    return out;
  };

  const chosen = [
    ...pick(by.broad, quota.broad || 0),
    ...pick(by.niche, quota.niche || 0),
    ...pick(by.audience, quota.audience || 0),
  ].map((x) => x.tag);

  const hashed = policy.tag_style === 'hashtag';
  const norm = (t) => {
    const raw = String(t).trim().replace(/^#+/, '');
    if (!raw) return '';
    return hashed ? '#' + raw.replace(/\s+/g, '') : raw;
  };

  const merged = [];
  for (const t of [...String(extra || '').split(/[\s,]+/).filter(Boolean), ...chosen]) {
    const v = norm(t);
    if (!v) continue;
    const k = v.toLowerCase();
    if (merged.some((m) => m.toLowerCase() === k)) continue;
    merged.push(v);
  }
  return merged.slice(0, policy.max_tags || 5).join(' ');
}

on('GET', /^\/api\/hashtags$/, async (m, b) => {
  const platform = b.platform || '';
  return {
    hashtags: platform
      ? all('select * from hashtag where platform = ? order by tier, weight desc', platform)
      : all('select * from hashtag order by platform, tier, weight desc'),
  };
});

/* ---------- 已发 Bluesky 帖的互动回捞 ---------- */
on('POST', /^\/api\/metrics\/sync-bsky$/, async (m, b) => {
  const rows = all(`select r.id, r.content_id, r.url, c.platform
                     from publish_result r join content c on c.id = r.content_id
                     where r.ok = 1 and r.url like 'https://bsky.app/%'`);
  const byContent = new Map();
  for (const r of rows) {
    const rkey = String(r.url).split('/').pop();
    if (rkey) byContent.set(r.content_id, rkey);
  }
  if (!byContent.size) return { ok: true, updated: 0, reason: '没有已发的 Bluesky 帖' };

  /* 先拿 did：通过任意一条帖子解析 */
  const firstRkey = [...byContent.values()][0];
  const probe = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' +
    encodeURIComponent('at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/' + firstRkey)).then((r) => r.json()).catch(() => null);
  const did = probe?.posts?.[0]?.author?.did;
  if (!did) return { ok: false, error: '解析作者 DID 失败' };

  const uris = [...byContent.values()].map((k) => 'at://' + did + '/app.bsky.feed.post/' + k);
  const updated = [];
  for (let i = 0; i < uris.length; i += 25) {
    const chunk = uris.slice(i, i + 25);
    const q = chunk.map((u) => 'uris=' + encodeURIComponent(u)).join('&');
    const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?' + q).then((r) => r.json()).catch(() => null);
    for (const p of (j?.posts || [])) {
      const rkey = String(p.uri).split('/').pop();
      const contentId = [...byContent.entries()].find(([, k]) => k === rkey)?.[0];
      if (!contentId) continue;
      const day = new Date().toISOString().slice(0, 10);
      run(`insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, inquiries, source)
           values (?,?,?,?,?,?,?,0,0,0,0,0,'bluesky_api')
           on conflict(content_id, day) do update set
             likes=excluded.likes, comments=excluded.comments, shares=excluded.shares, source='bluesky_api'`,
        contentId, 'bluesky', day, p.likeCount + p.repostCount + p.replyCount, p.likeCount, p.replyCount, p.repostCount);
      updated.push({ content_id: contentId, likes: p.likeCount, reposts: p.repostCount, replies: p.replyCount });
    }
  }
  audit('metrics.sync_bsky', 'all', { count: updated.length });
  return { ok: true, updated: updated.length, rows: updated };
});

/* ---------- 固定工作流：每一步的实时状态 ---------- */
on('GET', /^\/api\/workflow$/, async () => {
  const snapRow = get('select payload, fetched_at from radar_snapshot where id = 1');
  let radar = null;
  try { radar = snapRow ? JSON.parse(snapRow.payload) : null; } catch {}
  const cnt = (sql, ...p) => { try { return get(sql, ...p).c || 0; } catch { return 0; } };
  return {
    radar_at: snapRow ? snapRow.fetched_at : null,
    counts: {
      videos: (radar?.videos || []).length,
      posts: (radar?.posts || []).length,
      articles: (radar?.articles || []).length,
      products_scraped: (radar?.products || []).length,
      competitors: (radar?.competitors || []).length,
      audit_items: (radar?.audit?.items || []).length,
      audit_kw: (radar?.audit?.keywords || []).length,
      products: cnt('select count(*) c from product'),
      kb: cnt('select count(*) c from kb_item where enabled = 1'),
      pending: cnt("select count(*) c from content where status = 'pending_review'"),
      approved: cnt("select count(*) c from content where status = 'approved'"),
      rejected: cnt("select count(*) c from content where status = 'rejected'"),
      scheduled: cnt("select count(*) c from schedule where state = 'pending'"),
      published: cnt("select count(*) c from publish_result where ok = 1 and channel <> 'mock'"),
      mock: cnt("select count(*) c from publish_result where ok = 1 and channel = 'mock'"),
      metrics: cnt('select count(*) c from metric'),
    },
  };
});

/* ---------- 链路图数据 ---------- */
on('GET', /^\/api\/graph$/, async () => {
  const snapRow = get('select payload, fetched_at from radar_snapshot where id = 1');
  let radar = null;
  try { radar = snapRow ? JSON.parse(snapRow.payload) : null; } catch {}
  const cnt = (sql, ...p) => { try { return get(sql, ...p).c || 0; } catch { return 0; } };

  const nodes = [
    { key: 'radar', label: '情报采集', count: (radar?.videos?.length || 0) + (radar?.posts?.length || 0) + (radar?.articles?.length || 0) + (radar?.products?.length || 0), hint: '视频/帖子/文章/商品', go: 'radar' },
    { key: 'audit', label: 'kimi 质检', count: (radar?.audit?.items?.length || 0) + (radar?.audit?.keywords?.length || 0), hint: '雷达条目+关键词', go: 'radar' },
    { key: 'brief', label: 'kimi 简报', count: cnt("select count(*) c from content where model = 'rewrite-by-analysis'") , hint: '定角度/钩子/结构', go: 'generate' },
    { key: 'write', label: 'flash 写稿', count: cnt('select count(*) c from content'), hint: '一稿多平台', go: 'generate' },
    { key: 'image', label: '配图', count: cnt('select count(*) c from content where image_path is not null'), hint: '本地 SD / 或外部 API', go: 'review' },
    { key: 'review', label: '人工审核', count: cnt("select count(*) c from content where status = 'pending_review'"), hint: '待审', go: 'review' },
    { key: 'approve', label: '已通过', count: cnt("select count(*) c from content where status in ('approved','scheduled','published')"), hint: '', go: 'review' },
    { key: 'schedule', label: '排期', count: cnt("select count(*) c from schedule where state in ('pending','queued')"), hint: '', go: 'schedule' },
    { key: 'publish', label: '发布', count: cnt("select count(*) c from publish_result where ok = 1"), hint: '真实+测试', go: 'results' },
    { key: 'metrics', label: '数据回填', count: cnt('select count(*) c from metric'), hint: '曝光/互动/询盘', go: 'analytics' },
  ];

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push({ from: nodes[i].key, to: nodes[i + 1].key, kind: 'flow' });
  edges.push({ from: 'review', to: 'write', kind: 'reject', label: '打回重写' });
  edges.push({ from: 'metrics', to: 'radar', kind: 'loop', label: '复盘选题' });

  return { nodes, edges, at: snapRow ? snapRow.fetched_at : null };
});

/* ---------- 本地素材 ---------- */
on('GET', /^\/api\/media\/([\w.\-]+\.(?:jpg|jpeg|png|webp))$/, async (m, b, req, res) => {
  const { createReadStream, existsSync } = await import('node:fs');
  const { join, extname } = await import('node:path');
  const file = path.join(MEDIA_DIR, m[1]);
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return { __handled: true }; }
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' });
  createReadStream(file).pipe(res);
  return { __handled: true };
});

/* ---------- 平台目录 ---------- */
on('GET', /^\/api\/platforms$/, async () => {
  const platforms = all(`select p.*,
      (select count(*) from account a where a.platform = p.code) as accounts,
      (select count(*) from content c where c.platform = p.code) as contents,
      (select count(*) from publish_result r where r.platform = p.code and r.ok = 1 and r.channel <> 'mock') as published
    from platform_catalog p order by p.sort asc`);

  /* 目录里的 channel_state 只是"差什么"的静态说明，不能当现状：这里按真实能力重算 */
  const cat = (await channelCatalog()).filter((c) => c.key !== 'official');
  const byKey = Object.fromEntries(cat.map((c) => [c.key, c]));

  // Postiz 托管的平台共用一次探测结果，别每个平台各打一次
  // 云版建帖端点 90 次/小时（docs.postiz.com/cloud/limits），冷却与配额必须对用户可见，否则一撞 429 就是"莫名其妙发不出去"
  const pzMeta = (() => { try { return postizStatus(); } catch { return {}; } })();
  const pzTag = pzMeta.cloud ? ' · 云版（建帖端点 90 次/小时）' : '';
  const pzCoolMs = Number(pzMeta.cooldown_ms || 0);
  let pz = null;
  /* Postiz 到底能托管哪些平台，以 postiz.mjs 里的映射表为准，不看目录里的静态列：
     x / threads / youtube / linkedin 目录里写的是"待平台资质"，但 Postiz 云版自己有这三家的 OAuth 应用，
     说成"要去申请开发者"会把用户带去付 X API $200/月 的冤枉钱 */
  const postizHosted = (p) =>
    !!TYPE_CANDIDATES[p.code] && !NO_POSTIZ_CHANNEL[p.code] && !byKey[p.code];
  const hosted = platforms.filter(postizHosted);
  if (hosted.length) {
    try { pz = { ok: true, list: await postizIntegrations() }; }
    catch (e) { pz = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
  }

  for (const p of platforms) {
    const direct = byKey[p.code];
    // 这行由谁代发：Postiz 托管 / 本机直连适配器 / 都没有
    p.hosted_by = postizHosted(p) ? 'postiz' : (direct ? 'direct' : null);
    if (direct) {
      // mock 只是本地模拟，不能算"已发布到平台"
      p.channel_state = p.code === 'mock' ? 'local_sim' : direct.state;
      p.state_note = direct.note || p.channel_note || '';
      p.state_live = true;
      continue;
    }
    if (postizHosted(p)) {
      p.state_live = true;
      if (!pz) { p.state_note = 'Postiz 未探测'; }
      else if (!pz.ok) {
        const err = pz.error || '';
        const cfgMissing = /未配置 Postiz/.test(err);
        // 401/403 说明地址和请求形状都对、对方也在，只是 Key 不行——不能报成"服务没连上"
        const badAuth = /401|403|鉴权|Invalid API key|No API Key/i.test(err);
        const limited = /限流|429|rate_limited/i.test(err);
        if (cfgMissing) {
          p.channel_state = 'pending_config';
          p.state_note = err;
        } else if (badAuth) {
          p.channel_state = 'pending_credential';
          p.state_note = 'Postiz 已连通，但 Key 无效或已撤销（HTTP 401）· 点右侧按钮 → Settings → API Keys 重新复制' + pzTag;
        } else if (limited) {
          p.channel_state = 'pending_credential';
          p.state_note = err + (pzCoolMs > 0 ? '（冷却剩余约 ' + Math.ceil(pzCoolMs / 60000) + ' 分钟，期间不会重试）' : '');
        } else {
          p.channel_state = 'pending_connect';
          p.state_note = 'Postiz 连不上：' + err;
        }
      } else {
        const hit = await postizIntegrationFor(p.code, pz.list);
        p.channel_state = hit ? 'ready' : 'pending_postiz';
        p.state_note = (hit ? 'Postiz 已授权：' + (hit.name || hit.identifier || hit.id) : 'Postiz 通了，但没有这个平台的已授权通道') + pzTag;
      }
    }
  }

  /* 适配器能发、但目录里没有的通道（Bluesky / Mastodon）补进表里，否则用户看不到今天真能发的那个 */
  const known = new Set(platforms.map((p) => p.code));
  let sort = platforms.reduce((m, p) => Math.max(m, p.sort || 0), 0);
  for (const key of ['bluesky', 'mastodon']) {
    if (known.has(key) || !byKey[key]) continue;
    const agg = get(`select
        (select count(*) from account a where a.platform = ?) as accounts,
        (select count(*) from content c where c.platform = ?) as contents,
        (select count(*) from publish_result r where r.platform = ? and r.ok = 1 and r.channel <> 'mock') as published`, key, key, key);
    platforms.push({
      code: key,
      label: byKey[key].label || key,
      kind: 'social',
      channel_state: byKey[key].state,
      channel_note: byKey[key].note || '',
      state_note: byKey[key].note || '',
      state_live: true,
      hosted_by: 'direct',
      sort: ++sort,
      accounts: agg?.accounts || 0,
      contents: agg?.contents || 0,
      published: agg?.published || 0,
    });
  }

  const kinds = {};
  for (const r of platforms) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return { platforms, kinds };
});

/* ---------- 数据看板 ---------- */
function metricsRows(days) {
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return all(
    `select m.*, c.platform as cplatform, c.title, c.lang
     from metric m left join content c on c.id = m.content_id
     where m.day >= ? order by m.day asc`,
    since
  );
}

function aggregate(rows) {
  const t = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, sessions: 0, orders_amount: 0, inquiries: 0, posts: new Set() };
  for (const r of rows) {
    t.impressions += r.impressions || 0;
    t.likes += r.likes || 0;
    t.comments += r.comments || 0;
    t.shares += r.shares || 0;
    t.saves += r.saves || 0;
    t.clicks += r.clicks || 0;
    t.sessions += r.sessions || 0;
    t.orders_amount += r.orders_amount || 0;
    t.inquiries += r.inquiries || 0;
    if (r.content_id) t.posts.add(r.content_id);
  }
  const engagements = t.likes + t.comments + t.shares + t.saves;
  return {
    impressions: t.impressions, likes: t.likes, comments: t.comments, shares: t.shares, saves: t.saves,
    clicks: t.clicks, sessions: t.sessions, orders_amount: Math.round(t.orders_amount * 100) / 100, inquiries: t.inquiries,
    engagements,
    engagement_rate: t.impressions ? Math.round((engagements / t.impressions) * 1000) / 10 : 0,
    ctr: t.impressions ? Math.round((t.clicks / t.impressions) * 1000) / 10 : 0,
    posts: t.posts.size,
  };
}

on('GET', /^\/api\/metrics\/overview$/, async (m) => {
  const days = Number(new URL(m.__url, 'http://x').searchParams.get('days') || 30);
  const rows = metricsRows(days);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const seriesMap = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    seriesMap.set(d, { day: d, impressions: 0, engagements: 0, clicks: 0, sessions: 0 });
  }
  const platMap = new Map();
  const postMap = new Map();
  for (const r of rows) {
    const s = seriesMap.get(r.day);
    if (s) {
      s.impressions += r.impressions || 0;
      s.engagements += (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0);
      s.clicks += r.clicks || 0;
      s.sessions += r.sessions || 0;
    }
    const p = r.platform || r.cplatform || 'unknown';
    const cur = platMap.get(p) || { platform: p, impressions: 0, engagements: 0, clicks: 0, sessions: 0, inquiries: 0, posts: new Set() };
    cur.impressions += r.impressions || 0;
    cur.engagements += (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0);
    cur.clicks += r.clicks || 0;
    cur.sessions += r.sessions || 0;
    cur.inquiries += r.inquiries || 0;
    if (r.content_id) cur.posts.add(r.content_id);
    platMap.set(p, cur);
    if (r.content_id) {
      const k = r.content_id;
      const c = postMap.get(k) || { content_id: k, platform: p, title: r.title || '', impressions: 0, engagements: 0, clicks: 0, sessions: 0, orders_amount: 0, inquiries: 0 };
      c.impressions += r.impressions || 0;
      c.engagements += (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0);
      c.clicks += r.clicks || 0;
      c.sessions += r.sessions || 0;
      c.orders_amount += r.orders_amount || 0;
      c.inquiries += r.inquiries || 0;
      postMap.set(k, c);
    }
  }
  const byPlatform = [...platMap.values()].map((p) => ({
    ...p, posts: p.posts.size,
    engagement_rate: p.impressions ? Math.round((p.engagements / p.impressions) * 1000) / 10 : 0,
    ctr: p.impressions ? Math.round((p.clicks / p.impressions) * 1000) / 10 : 0,
  })).sort((a, b) => b.impressions - a.impressions);
  const topPosts = [...postMap.values()].map((p) => ({
    ...p, engagement_rate: p.impressions ? Math.round((p.engagements / p.impressions) * 1000) / 10 : 0,
  })).sort((a, b) => b.engagements - a.engagements).slice(0, 12);
  const sources = { manual: 0, demo: 0, postiz: 0, other: 0 };
  for (const r of rows) {
    const s = r.source || 'manual';
    if (s in sources) sources[s]++; else sources.other++;
  }
  return { days, since, totals: aggregate(rows), series: [...seriesMap.values()], by_platform: byPlatform, top_posts: topPosts, sources, hasDemo: sources.demo > 0, rows: rows.length };
});

on('GET', /^\/api\/metrics\/pending$/, async () => ({
  posts: all(`select c.id, c.platform, c.title, c.status, substr(c.body,1,120) as excerpt,
      (select count(*) from metric m where m.content_id = c.id) as metric_days,
      (select max(m.day) from metric m where m.content_id = c.id) as last_day
    from content c where c.status in ('published','approved') order by c.id desc limit 50`),
}));

on('POST', /^\/api\/metrics$/, async (m, b) => {
  const cid = Number(b.content_id);
  const c = get('select * from content where id = ?', cid);
  if (!c) throw new Error('内容不存在');
  const day = (b.day || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const num = (v) => Math.max(0, Math.round(Number(v) || 0));
  run(
    `insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, inquiries, source)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?)
     on conflict(content_id, day) do update set
       impressions=excluded.impressions, likes=excluded.likes, comments=excluded.comments, shares=excluded.shares,
       saves=excluded.saves, clicks=excluded.clicks, sessions=excluded.sessions, orders_amount=excluded.orders_amount, inquiries=excluded.inquiries,
       source=excluded.source`,
    cid, b.platform || c.platform, day, num(b.impressions), num(b.likes), num(b.comments), num(b.shares),
    num(b.saves), num(b.clicks), num(b.sessions), Number(b.orders_amount) || 0, num(b.inquiries), b.source || 'manual'
  );
  audit('metric.upsert', `content:${cid}`, { day });
  return { ok: true, content_id: cid, day };
});

on('DELETE', /^\/api\/metrics\/(\d+)$/, async (m) => {
  run('delete from metric where id = ?', Number(m[1]));
  return { ok: true };
});

on('POST', /^\/api\/metrics\/demo$/, async () => {
  const contents = all("select id, platform from content where status in ('published','approved','pending_review') order by id desc limit 3");
  if (!contents.length) return { ok: false, reason: '先至少有一条内容，再导入示例看板数据' };
  run("delete from metric where source = 'demo'");
  let n = 0;
  for (const c of contents) {
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const impressions = 400 + Math.round(Math.random() * 2600);
      const likes = Math.round(impressions * (0.02 + Math.random() * 0.05));
      const comments = Math.round(likes * (0.05 + Math.random() * 0.1));
      const shares = Math.round(likes * (0.02 + Math.random() * 0.06));
      const saves = Math.round(likes * (0.05 + Math.random() * 0.1));
      const clicks = Math.round(impressions * (0.004 + Math.random() * 0.01));
      const sessions = Math.round(clicks * (0.6 + Math.random() * 0.3));
      const orders = Math.round(Math.random() * 2) * 40;
      run(
        `insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, source)
         values (?,?,?,?,?,?,?,?,?,?,?,'demo')
         on conflict(content_id, day) do nothing`,
        c.id, c.platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders
      );
      n++;
    }
  }
  audit('metric.demo', '', { rows: n });
  return { ok: true, rows: n, note: '示例数据，会带 source=demo 标记，随时可一键清除' };
});

on('DELETE', /^\/api\/metrics\/demo$/, async () => {
  const r = run("delete from metric where source = 'demo'");
  audit('metric.demo_clear', '', {});
  return { ok: true, removed: r.changes };
});

/* ---------- 台账 ---------- */
on('GET', /^\/api\/ledger$/, async () => {
  const gw = await pingBuiltin();
  const modelCount = get('select count(*) c from model_endpoint').c;
  const ledger = [
    { module: '模型接入设置', stage: 'MVP', state: '已跑通', detail: `内置网关可用（${gw.ok ? (gw.models || []).length + ' 个模型' : '不可用'}），自定义接口 ${modelCount} 个；主备顺序 + 测试连接 + Key 只显示后四位` },
    { module: '产品与素材库', stage: 'MVP', state: '部分跑通', detail: '产品增删改查已跑通；素材上传、AI 生图、Pexels 接入待做' },
    { module: '爆款库', stage: 'MVP', state: '部分跑通', detail: '手工粘贴入库 + 结构拆解已跑通；Apify 自动采集待接（需 Apify Token）' },
    { module: 'AI 二创', stage: 'MVP', state: '已跑通', detail: '结构拆解 → 一稿多平台（FB/IG/TikTok/Pinterest）→ 相似度粗判' },
    { module: '审核队列', stage: 'MVP', state: '已跑通', detail: 'AI 预审打分 + 人工通过/打回；auto 模式下 AI 通过即放行' },
    { module: 'AI 分析（SEO / GEO）', stage: 'MVP', state: '已跑通', detail: '每条内容可单点分析：SEO 与 GEO 双评分 + 问题 + 改法 + 建议标题；每条爆款可分析「为什么火 / 打的是谁 / 可复用点」' },
    { module: '品牌知识库', stage: 'MVP', state: '已跑通', detail: '品牌/产品/客户/语气/术语/禁用词/案例，生成与审核时自动注入' },
    { module: '发布中心', stage: 'MVP', state: '部分跑通', detail: 'mock / webhook 已跑通；Postiz 公开 API v1 适配器已按官方 OpenAPI 契约写完并通过本机契约桩端到端验证（now/draft、通道匹配、错误分类），等自建 Postiz 起来换 Base URL 即可真发；IG/TikTok/Pinterest 需素材，上传管线未接' },
    { module: '数据看板', stage: 'MVP', state: '部分跑通', detail: '手工按天回填指标 + 趋势/平台对比/帖子排行已跑通；Postiz 指标拉取与 GA4 Data API 未接（示例数据带 demo 标记，可一键清）' },
    { module: '平台覆盖（含论坛）', stage: 'MVP', state: '部分跑通', detail: '20 个渠道入库：社媒 9 / 论坛 4 / B2B 3 / 私信 3 / 本地 2；状态逐平台标注，差什么写在覆盖页' },
    { module: '互动回复', stage: '二期', state: '未开始', detail: '' },
    { module: '竞品定时跟踪', stage: '二期', state: '未开始', detail: '' },
    { module: '视频生成', stage: '二期', state: '未开始', detail: '脚本已包含在 TikTok 版本里，视频生成需接视频模型' },
    { module: '多用户与权限', stage: '二期', state: '未开始', detail: '' },
    { module: '服务器部署', stage: '二期', state: '未开始', detail: '本机已能跑，上服务器需 HTTPS 域名 + Docker' },
  ];
  return { ledger, at: nowIso() };
});

/* ---------- 缩略图代理（避免浏览器跨站拦截 + 统一缓存） ---------- */
const THUMB_DIR = path.join(ROOT, 'data', 'thumbs');
try { mkdirSync(THUMB_DIR, { recursive: true }); } catch {}
const thumbCache = new Map();

on('GET', /^\/api\/thumb$/, async (m, b, req, res) => {
  const u = new URL(m.__url, 'http://x').searchParams.get('u');
  if (!u) throw new Error('缺少 u');
  const target = new URL(u);
  if (target.protocol !== 'https:') throw new Error('只允许 https');
  const host = target.hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error('禁止内网地址');
  const cached = thumbCache.get(target.href);
  if (cached) { res.writeHead(200, { 'content-type': cached.type, 'cache-control': 'public, max-age=86400' }); res.end(cached.buf); return { __handled: true }; }
  const r = await fetch(target.href, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://' + host + '/' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const type = r.headers.get('content-type') || '';
  if (!/^image\//.test(type)) throw new Error('不是图片');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) throw new Error('图片过大');
  thumbCache.set(target.href, { buf, type });
  if (thumbCache.size > 500) thumbCache.delete(thumbCache.keys().next().value);
  res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=86400' });
  res.end(buf);
  return { __handled: true };
});
/* ---------- 静态 ---------- */
async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = pathname.match(r.pattern);
    if (!m) continue;
    try {
      const b = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await body(req) : {};
      m.__url = req.url;
      const out = await r.fn(m, b, req, res);
      if (out && out.__handled) return;
      send(res, 200, out ?? { ok: true });
    } catch (e) {
      send(res, 400, { error: e.message });
    }
    return;
  }
  send(res, 404, { error: 'no route', path: pathname });
});

setInterval(() => {
  tick().catch((e) => console.error('[tick]', e.message));
}, 3000);

/* 每 30 分钟回捞一次 Bluesky 互动数据 */
setInterval(() => {
  fetch(`http://127.0.0.1:${PORT}/api/metrics/sync-bsky`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .catch(() => {});
}, 30 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`[social-workbench] http://127.0.0.1:${PORT}`);
  console.log(`[social-workbench] data: ${process.env.SWB_DATA || path.join(ROOT, 'data')}`);
  if (process.env.SWB_CRYPTO_WEAK === '1') console.log('[social-workbench] 警告：DPAPI 不可用，主密钥以明文保存');
  tick().catch(() => {});
});
