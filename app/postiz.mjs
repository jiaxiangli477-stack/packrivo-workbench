import { get, run, setting } from './db.mjs';
import { encrypt, decrypt, keyHint } from './crypto.mjs';
import { PublishError, RESULT_UNKNOWN_CLASS } from './errors.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';

/* Postiz 发布中心适配器 —— 对的是它的公开 API v1：
   POST {base}/api/public/v1/posts        （自建）
   POST {base}/public/v1/posts            （api.postiz.com）
   鉴权：Authorization: <api key>（裸 key，不带 Bearer）
   契约来源：gitroomhq/postiz-docs → public-api/openapi.json（2026-10-26 取） */

const OWNER_KIND = 'channel';
const OWNER_ID = 0;
const KEY_FIELD = 'postiz_key';

/* 工作台平台 → Postiz identifier 候选。公司页/个人号这种同平台多授权按顺序先匹配 */
export const TYPE_CANDIDATES = {
  x: ['x'],
  linkedin: ['linkedin', 'linkedin-page'],
  facebook_page: ['facebook'],
  instagram: ['instagram', 'instagram-standalone'],
  threads: ['threads'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
  pinterest: ['pinterest'],
  reddit: ['reddit', 'lemmy'],
  telegram: ['telegram'],
  bluesky: ['bluesky'],
  mastodon: ['mastodon'],
  discord: ['discord'],
  wordpress: ['wordpress'],
};

/* Postiz 没有发布通道的平台：不硬凑，直接判 blocked 并说明 */
export const NO_POSTIZ_CHANNEL = {
  facebook_group: 'Postiz 没有 FB 群组发布器（群组只能会话发帖）',
  quora: 'Postiz 没有 Quora 通道',
  warrior_forum: 'Postiz 没有该论坛通道',
  alibaba: 'Postiz 没有 Alibaba 国际站通道',
  made_in_china: 'Postiz 没有中国制造网通道',
  globalsources: 'Postiz 没有环球资源通道',
  whatsapp: 'Postiz 没有 WhatsApp Cloud API 发布器',
  email: '邮件走 SMTP / Listmonk，不归 Postiz',
};

/* 这几种平台没有图/视频发不出去。素材上传已经接了 /upload，没配图才拦 */
const MEDIA_REQUIRED = new Set(['instagram', 'instagram-standalone', 'tiktok', 'youtube', 'pinterest']);

/* ---------- Base URL ---------- */
export function normalizeBase(raw) {
  let base = String(raw || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (/\/api\/public\/v1$/i.test(base) || /\/public\/v1$/i.test(base)) return base;
  if (/\/api$/i.test(base)) return base + '/public/v1';
  if (/^https?:\/\/api\.postiz\.com$/i.test(base)) return base + '/public/v1';
  return base + '/api/public/v1';
}

export function apiBase() {
  return normalizeBase(setting('postiz_base'));
}

/* 官方云版的公开 API 有硬限流（docs.postiz.com/cloud/limits：建帖端点 90 次/小时，固定值不随档位变；
   public-api/introduction 括号里写 100，两处一字差，按 limits 页的 90 兜底；自建用 API_LIMIT 可调）。
   自建实例随便打，云版必须把缓存拉长，否则刷两次平台页就把额度烧光。 */
const CLOUD_TTL_MS = 10 * 60 * 1000;
const SELF_TTL_MS = 60 * 1000;

export function isCloud() {
  return /^https?:\/\/api\.postiz\.com/i.test(apiBase());
}

/* 吃到 429 之后的冷却窗口：期间只吐缓存，一次请求都不再往外发 */
let cooldownUntil = 0;
export function cooldownLeftMs() {
  return Math.max(0, cooldownUntil - Date.now());
}
function listTtlMs() {
  return isCloud() ? CLOUD_TTL_MS : SELF_TTL_MS;
}

/* ---------- API Key（AES-256-GCM 列级加密，DPAPI 包主密钥） ---------- */
export function saveKey(key) {
  const k = String(key || '').trim();
  run('delete from credential where owner_kind = ? and owner_id = ? and field = ?', OWNER_KIND, OWNER_ID, KEY_FIELD);
  if (!k) return { saved: false, hint: '' };
  run('insert into credential(owner_kind, owner_id, field, cipher, hint) values (?,?,?,?,?)',
    OWNER_KIND, OWNER_ID, KEY_FIELD, encrypt(k), keyHint(k));
  return { saved: true, hint: keyHint(k) };
}

export function keyView() {
  const r = get('select hint from credential where owner_kind = ? and owner_id = ? and field = ? order by id desc limit 1',
    OWNER_KIND, OWNER_ID, KEY_FIELD);
  return { saved: !!r, hint: r?.hint || '' };
}

function readKey() {
  const r = get('select cipher from credential where owner_kind = ? and owner_id = ? and field = ? order by id desc limit 1',
    OWNER_KIND, OWNER_ID, KEY_FIELD);
  if (r?.cipher) {
    try { return decrypt(r.cipher); } catch { return ''; }
  }
  // 兼容早期直接写 setting 的明文（只在没有加密记录时兜底）
  return String(setting('postiz_key') || '');
}

/* ---------- HTTP ---------- */
/* 最近一次真实请求的连通性：通道状态据此判 ready/pending_api，避免"配了 Key 就报 ready" */
let lastHealth = null;

export function health() {
  return lastHealth;
}

function noteHealth(ok, error = '') {
  lastHealth = { ok, error: String(error).slice(0, 200), at: new Date().toISOString().replace('T', ' ').slice(0, 19) };
}

/* 真去探一次 Postiz 连通性（/api/channels 用）。20 秒内复用结果，避免界面轮询把对方打爆 */
let liveCache = { at: 0, value: null };
export async function reachable(ttlMs = 20000) {
  const now = Date.now();
  if (liveCache.value && now - liveCache.at < ttlMs) return liveCache.value;
  // 探测本身也要耗一次请求，先占位，别让并发调用同时打
  liveCache = { at: now, value: liveCache.value };
  let value;
  try {
    // 不 force：云版建帖额度按小时算，通道页轮询不能每次都真打
    await listIntegrations(false);
    value = health();
  } catch (e) {
    value = { ok: false, error: String(e?.message || e).slice(0, 200), at: new Date().toISOString().replace('T', ' ').slice(0, 19) };
  }
  liveCache = { at: Date.now(), value };
  return value;
}

async function api(method, pathname, payload, opts = {}) {
  const base = apiBase();
  if (!base) throw new PublishError('pending_config', '未配置 Postiz 地址（设置 → 外部对接 → Postiz Base URL）');
  const key = readKey();
  if (!key) throw new PublishError('pending_config', '未配置 Postiz API Key（设置 → 外部对接 → Postiz API Key，保存后点验证）');

  const url = base + pathname;
  // 冷却短路：命中 429 后整段冷却期内，任何端点都不再往外发（upload / posts / integrations 一视同仁）。
  // 之前只在 listIntegrations 里拦，直接发布/上传会绕过冷却继续打网络；这里在出站唯一入口统一拦住。
  if (cooldownLeftMs() > 0) {
    throw new PublishError('rate_limited',
      `Postiz 限流冷却中（还要约 ${Math.ceil(cooldownLeftMs() / 60000)} 分钟），冷却期内不发起新请求`);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: key,
        // multipart 的 boundary 必须让 fetch 自己写，手写 content-type 会被对方拒
        ...(opts.form ? {} : { 'content-type': 'application/json' }),
        'user-agent': 'social-workbench/0.1 (+postiz-public-v1)',
      },
      body: opts.form ? opts.form : payload === undefined ? undefined : JSON.stringify(payload),
      signal: ac.signal,
    });
  } catch (e) {
    const why = e.name === 'AbortError' ? '30s 超时' : (e.cause?.code || e.message);
    noteHealth(false, why);
    // 建帖这种有副作用的调用：连接被拒/域名不解析 = 请求没写出去，重发安全；
    // 超时/连接被重置 = 远端可能已经建了帖，重发就是重复发布。
    const code = String(e.cause?.code || '');
    const neverSent = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ERR_INVALID_URL'].includes(code);
    const intent = !!opts.intent;
    throw new PublishError('upstream_error', `连不上 Postiz：${url}（${why}）`, '', {
      dispatched: intent && !neverSent,
      outcomeKnown: !intent || neverSent,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // 走到这里说明请求确实发出去了，远端也给了明确响应：结果可判定
  const sentKnown = { dispatched: !!opts.intent, outcomeKnown: true };
  if (res.status === 401 || res.status === 403) {
    noteHealth(false, 'HTTP ' + res.status + ' 鉴权失败');
    throw new PublishError('pending_config', `Postiz 拒绝鉴权（HTTP ${res.status}）：API Key 不对或已撤销`, text.slice(0, 300), sentKnown);
  }
  if (res.status === 404) {
    noteHealth(false, 'HTTP 404 ' + url);
    throw new PublishError('pending_config', `Postiz 路径 404：Base URL 解析成 ${base}，确认自建版本与端口`, text.slice(0, 300), sentKnown);
  }
  if (res.status === 429) {
    // 云版额度是整实例单值、不分档位，撞上就老老实实等，不能靠重试硬顶
    const wait = Math.max(60, Number(res.headers.get('retry-after') || 0) || 900);
    cooldownUntil = Date.now() + wait * 1000;
    noteHealth(true, `HTTP 429 限流（服务是通的，冷却 ${Math.round(wait / 60)} 分钟）`);
    throw new PublishError('rate_limited',
      `Postiz 限流（HTTP 429）：云版建帖端点 90 次/小时，冷却 ${Math.round(wait / 60)} 分钟后自动恢复`, text.slice(0, 300), sentKnown);
  }
  if (!res.ok) {
    noteHealth(false, 'HTTP ' + res.status);
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = [j.msg, j.message, j.error].filter(Boolean).join(' / ') || msg;
    } catch {}
    throw new PublishError('upstream_error', `Postiz 返回 HTTP ${res.status}：${msg}`, text.slice(0, 800), sentKnown);
  }
  noteHealth(true);
  // 2xx 也可能是反代/网关吐的 HTML：解析不出来就抛，不给上层"看起来成功了"的机会。
  // 对有副作用的调用，这里必须标成「已发出、结果未知」——帖子可能已经建了。
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    noteHealth(false, 'HTTP 2xx 但响应不是 JSON');
    throw new PublishError('upstream_error', `Postiz 返回 HTTP 2xx 但不是 JSON（多半是反向代理错误页）：${url}`, text.slice(0, 400),
      { dispatched: !!opts.intent, outcomeKnown: !opts.intent });
  }
}

/* ---------- 通道（integration）发现与匹配 ---------- */
let cache = { at: 0, list: [] };

export function invalidateCache() {
  cache = { at: 0, list: [] };
}

/* 连通性探针缓存也一并清（自测/换 key 后用，避免旧 ok 结果再兜 20 秒） */
export function invalidateReachable() {
  liveCache = { at: 0, value: null };
}

export async function listIntegrations(force = false) {
  if (!force && cache.list.length && Date.now() - cache.at < listTtlMs()) return cache.list;
  // 冷却期里宁可给旧列表（上层只会说"还没这条通道"），也不再去撞限流
  if (!force && !cache.list.length && cooldownLeftMs() > 0) {
    throw new PublishError('rate_limited',
      `Postiz 限流中，还要等 ${Math.ceil(cooldownLeftMs() / 60000)} 分钟；先别刷新平台页`);
  }
  const data = await api('GET', '/integrations');
  const list = Array.isArray(data) ? data : Array.isArray(data?.integrations) ? data.integrations : [];
  cache = { at: Date.now(), list };
  return list;
}

/* 注意：这个函数只给「平台覆盖」页做展示用——它按 identifier 找第一条匹配的 integration。
   发布路径绝对不许用它：同一平台接两个号（两个 LinkedIn / 两个 YouTube）时，
   find(i => i.identifier === cand) 永远返回列表里第一个，于是「发到 B 号」实际发到 A 号。
   发布只认账号上显式绑定的 integration_id（resolveBoundIntegration）。 */
function matchIntegration(platform, list) {
  const explicit = jsonSetting('postiz_integration_map', {});
  const forcedId = explicit[platform];
  if (forcedId) {
    const hit = list.find((i) => i.id === forcedId);
    if (hit) return hit;
  }
  const candidates = TYPE_CANDIDATES[platform] || [platform];
  for (const cand of candidates) {
    const hit = list.find((i) => !i.disabled && i.identifier === cand);
    if (hit) return hit;
  }
  return null;
}

/* 给「平台覆盖」页用：这条平台在 Postiz 里有没有已授权的通道 */
export async function integrationFor(platform, list) {
  const arr = list || (await listIntegrations());
  return matchIntegration(platform, arr);
}

/* PUB-04：账号 → integration 的显式绑定。
   空绑定直接拦（不再「按平台猜一个」），绑的 id 不存在/已停用/类型对不上平台也拦。
   这三条都是「配置没弄好」，走 pending_integration → schedule 变 blocked，不进重试。 */
export function resolveBoundIntegration(account, platform, list) {
  const id = String(account?.integration_id || '').trim();
  if (!id) {
    const hint = list.map((i) => `${i.identifier}:${i.id}`).filter(Boolean).join(', ') || '空';
    throw new PublishError('pending_integration',
      `账号 #${account?.id ?? '?'}（${account?.handle || '?'}）还没绑定 Postiz integration。`
      + `到「账号」页填 integration_id；当前 Postiz 里可用的有：${hint}`, '', { dispatched: false, outcomeKnown: true });
  }
  const hit = list.find((i) => String(i.id) === id);
  if (!hit) {
    throw new PublishError('pending_integration',
      `账号 #${account.id} 绑定的 integration ${id} 在 Postiz 里不存在（可能已删除或换实例）`, '', { dispatched: false, outcomeKnown: true });
  }
  if (hit.disabled) {
    throw new PublishError('pending_integration',
      `账号 #${account.id} 绑定的 integration ${id}（${hit.identifier || '?'}）在 Postiz 里已停用`, '', { dispatched: false, outcomeKnown: true });
  }
  const cands = TYPE_CANDIDATES[platform] || [];
  const ident = String(hit.identifier || '');
  if (cands.length && !cands.includes(ident)) {
    throw new PublishError('pending_integration',
      `账号 #${account.id} 绑的 integration ${id} 类型是 ${ident || '未知'}，与内容平台 ${platform} 不匹配`, '', { dispatched: false, outcomeKnown: true });
  }
  return hit;
}

/* ---------- 平台 settings ---------- */
function jsonSetting(key, fallback) {
  try {
    const v = JSON.parse(setting(key) || '');
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

function buildSettings(identifier, content) {
  const extra = jsonSetting('postiz_settings', {});
  const s = { __type: identifier, ...(extra[identifier] || {}) };

  if (identifier === 'x') {
    if (!s.who_can_reply_post) s.who_can_reply_post = 'everyone';
  }
  if (identifier === 'instagram' || identifier === 'instagram-standalone') {
    if (!s.post_type) s.post_type = 'post';
  }
  if (identifier === 'tiktok') {
    if (!s.privacy_level) s.privacy_level = 'PUBLIC_TO_EVERYONE';
    if (!s.content_posting_method) s.content_posting_method = 'DIRECT_POST';
    if (s.duet === undefined) s.duet = false;
    if (s.stitch === undefined) s.stitch = false;
    if (s.comment === undefined) s.comment = true;
    if (s.autoAddMusic === undefined) s.autoAddMusic = 'yes';
    if (s.brand_content_toggle === undefined) s.brand_content_toggle = false;
    if (s.brand_organic_toggle === undefined) s.brand_organic_toggle = false;
  }
  if (identifier === 'pinterest' && !s.board) {
    throw new PublishError('pending_config',
      'Pinterest 必须指定 board id：设置里填 postiz_settings = {"pinterest":{"board":"<board-id>","link":""}}');
  }
  if (identifier === 'youtube') {
    const title = String(s.title || content?.title || '').split('\n')[0].trim().slice(0, 100);
    if (title.length < 2) throw new PublishError('pending_config', 'YouTube 要求标题 2-100 字，当前内容没有标题');
    s.title = title;
    if (!s.type) s.type = 'public';
    if (!s.selfDeclaredMadeForKids) s.selfDeclaredMadeForKids = 'no';
  }
  if ((identifier === 'reddit' || identifier === 'lemmy') && !Array.isArray(s.subreddit)) {
    throw new PublishError('pending_config',
      'Reddit/Lemmy 必须指定 subreddit：postiz_settings = {"reddit":{"subreddit":[{"value":{"subreddit":"saas","title":"标题","type":"self","url":"","is_flair_required":false,"flair":null}}]}}');
  }
  if ((identifier === 'discord' || identifier === 'slack') && !s.channel) {
    throw new PublishError('pending_config', `${identifier} 必须指定 channel id：postiz_settings.${identifier}.channel`);
  }
  return s;
}

function composeText(content) {
  const parts = [];
  const title = String(content?.title || '').trim();
  const body = String(content?.body || '').trim();
  if (title) parts.push(title);
  if (body) parts.push(body);
  const joined = parts.join('\n\n');
  const tags = String(content?.hashtags || '').trim();
  if (tags && !joined.includes(tags.split(/\s+/)[0])) parts.push(tags);
  const utm = String(content?.utm_url || '').trim();
  if (utm && !parts.join('\n\n').includes(utm)) parts.push(utm);
  return parts.filter(Boolean).join('\n\n');
}

/* ---------- 状态 / 验证 ---------- */
export function status() {
  const base = apiBase();
  const k = keyView();
  const last = lastHealth;
  // 平台状态三态：key 无效 / 连不上 / 可用，凭最近一次真实请求的 HTTP 结果判定，不是"配没配"。
  let connectivity = 'unknown';   // unknown | ok | key_invalid | unreachable
  let detail = '';
  if (last && last.ok === true) connectivity = 'ok';
  else if (last && last.ok === false) {
    // 401/403 = 请求到了上游、对方在、Key 不对 → key_invalid；其余（超时/连接拒绝/网络）→ unreachable
    const authRe = /401|403|鉴权|Invalid API key|No API Key|API Key 不对|拒绝鉴权/i;
    connectivity = authRe.test(last.error) ? 'key_invalid' : 'unreachable';
    detail = last.error;
  }
  return {
    base,
    base_raw: setting('postiz_base') || '',
    key_saved: k.saved,
    key_hint: k.hint,
    configured: !!base && k.saved,
    cloud: isCloud(),
    cache_ttl_ms: listTtlMs(),
    cooldown_ms: cooldownLeftMs(),
    connectivity,
    connectivity_detail: detail,
    post_type_mode: setting('postiz_type') || 'now',
    integration_map: jsonSetting('postiz_integration_map', {}),
  };
}

export async function verify() {
  const base = apiBase();
  if (!base) throw new PublishError('pending_config', '未配置 Postiz Base URL');
  if (!keyView().saved) throw new PublishError('pending_config', '未配置 Postiz API Key');

  const list = await listIntegrations(true);
  const matched = {};
  const unmatched = [];
  for (const platform of Object.keys(TYPE_CANDIDATES)) {
    const hit = matchIntegration(platform, list);
    if (hit) matched[platform] = { id: hit.id, identifier: hit.identifier, name: hit.name };
    else unmatched.push(platform);
  }
  return {
    ok: true,
    base,
    cloud: isCloud(),
    key_hint: keyView().hint,
    count: list.length,
    integrations: list.map((i) => ({
      id: i.id,
      identifier: i.identifier || '',
      name: i.name || '',
      profile: i.profile || '',
      disabled: !!i.disabled,
      customer: i.customer?.name || '',
    })),
    matched,
    unmatched,
  };
}

/* ---------- 素材上传（POST /upload，multipart 字段名 file） ---------- */
/* 云版和自建都支持；只认 Postiz 白名单里的类型，本地先挡掉再发，省得白跑一次限额 */
const UPLOAD_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff', mp4: 'video/mp4',
};
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;            // /posts 请求体上限
/* 单文件上限按官网：图片 10 MB、视频 1 GB（docs.postiz.com/cloud/limits，不分档位） */
const UPLOAD_FILE_MAX = { image: 10 * 1024 * 1024, video: 1024 * 1024 * 1024 };
/* 同一张图重复发（多平台排期）不该重复上传，按 路径+大小+修改时间 复用 */
const uploadCache = new Map();

export async function uploadMedia(filePath) {
  const p = String(filePath || '').trim();
  if (!p) throw new PublishError('pending_media', '这条内容没有配图（content.image_path 为空）');
  if (!existsSync(p)) throw new PublishError('pending_media', `配图文件不存在：${p}`);
  const st = statSync(p);
  if (!st.isFile()) throw new PublishError('pending_media', `配图路径不是文件：${p}`);
  const ext = String(p.split('.').pop() || '').toLowerCase();
  const mime = UPLOAD_MIME[ext];
  if (!mime) {
    throw new PublishError('pending_media',
      `Postiz 公开 API 不收 .${ext}：只收 jpg/png/gif/webp/avif/bmp/tiff/mp4（PDF 也不行）`);
  }

  const isVideo = mime.startsWith('video/');
  const cap = isVideo ? UPLOAD_FILE_MAX.video : UPLOAD_FILE_MAX.image;
  if (st.size > cap) {
    const mb = (n) => Math.round(n / 1048576);
    throw new PublishError('pending_media',
      `文件 ${mb(st.size)}MB 超过 Postiz 单文件上限（${isVideo ? '视频 1GB' : '图片 10MB'}）；${isVideo ? '先压到 1GB 内' : '先压到 10MB 内再发'}`);
  }
  if (st.size > UPLOAD_MAX_BYTES) {
    throw new PublishError('pending_media', `文件 ${Math.round(st.size / 1048576)}MB 超过 /posts 请求体 50MB 上限`);
  }

  const ck = `${apiBase()}|${p}|${st.size}|${Math.round(st.mtimeMs)}`;
  const hit = uploadCache.get(ck);
  if (hit) return hit;

  const name = p.split(/[\\/]/).pop();
  const form = new FormData();
  form.append('file', new Blob([readFileSync(p)], { type: mime }), name);
  const res = await api('POST', '/upload', undefined, { form });
  const id = String(res?.id ?? res?.fileId ?? '');
  const path = String(res?.path ?? res?.url ?? '');
  if (!id || !path) {
    throw new PublishError('upstream_error',
      'Postiz /upload 返回里没有 id/path，没法把图挂到帖子上', JSON.stringify(res).slice(0, 400));
  }
  const out = { id, path };
  uploadCache.set(ck, out);
  return out;
}

/* ---------- 发布 ---------- */
/* PUB-02：模式由调用方按请求传入（draft / schedule / now），不再读写全局 postiz_type。
   旧实现是「临时 setSetting('postiz_type','draft') → 发布 → finally 改回去」，
   两条请求并发时后一条会读到前一条的 draft，或者把前一条的 now 覆盖成 draft。 */
export function normalizePublishMode(mode, fallback = 'now') {
  const m = String(mode || '').toLowerCase();
  if (m === 'draft' || m === 'schedule' || m === 'now') return m;
  const f = String(fallback || '').toLowerCase();
  return (f === 'draft' || f === 'schedule' || f === 'now') ? f : 'now';
}

export async function publish({ content, account, platform, schedule, mode }) {
  const publishMode = normalizePublishMode(mode, schedule?.publish_mode || setting('postiz_type') || 'now');
  if (NO_POSTIZ_CHANNEL[platform]) {
    throw new PublishError('pending_integration', NO_POSTIZ_CHANNEL[platform]);
  }
  if (!TYPE_CANDIDATES[platform]) {
    throw new PublishError('pending_integration', `Postiz 公开 API 没有 ${platform} 的发布器`);
  }

  const list = await listIntegrations();
  // PUB-04：只认账号自己绑的 integration，绝不按平台猜
  const integration = resolveBoundIntegration(account, platform, list);

  const identifier = integration.identifier;

  // 有配图就真传上去；没配图且平台非要图，才拦（不再是"一律拦"）
  let images = [];
  if (content?.image_path) {
    const up = await uploadMedia(content.image_path);
    const item = { id: up.id, path: up.path };
    // alt 只有部分平台吃（IG / IG Standalone / Bluesky / Mastodon / Slack / Tumblr），其余忽略
    const alt = String(content.image_alt || content.title || '').trim().slice(0, 1000);
    if (alt) item.alt = alt;
    images = [item];
  }
  if (MEDIA_REQUIRED.has(identifier) && !images.length) {
    throw new PublishError('pending_media',
      `${identifier} 必须带图/视频才能发；这条内容没有配图（先在图库生成或上传一张再排期）`);
  }

  const settings = buildSettings(identifier, content);
  let date;
  if (publishMode === 'schedule') {
    if (!schedule?.run_at) throw new PublishError('pending_config', 'schedule 模式但这条排期没有 run_at', '', { dispatched: false, outcomeKnown: true });
    date = new Date(String(schedule.run_at).replace(' ', 'T') + 'Z').toISOString();
  } else {
    date = new Date().toISOString();
  }

  const payload = {
    type: publishMode,
    date,
    shortLink: setting('postiz_shortlink') === '1',
    tags: [],
    posts: [
      {
        integration: { id: integration.id },
        value: [{ content: composeText(content), image: images }],
        settings,
      },
    ],
  };

  // intent=true：这是有副作用的建帖调用，网络中断时结果不可假定为「没发出去」
  const res = await api('POST', '/posts', payload, { intent: true });
  const first = Array.isArray(res) ? res[0] : res;
  const postId = String(first?.postId || first?.id || first?.post_id || '');
  const url = first?.releaseURL || first?.url || first?.releaseUrl || '';
  // Postiz 建了帖但不回 id，说明响应结构变了或没真建成功：不许拿本地随机串冒充平台 id。
  // 这里帖子很可能已经进了 Postiz 队列，只能标「结果未知」等人工核对，不能重发。
  if (!postId) {
    throw new PublishError(RESULT_UNKNOWN_CLASS,
      'Postiz 返回 2xx 但没有 postId，无法确认这条真的进了 Postiz 队列（已按结果未知处理，不重发）',
      JSON.stringify(res).slice(0, 400), { dispatched: true, outcomeKnown: false });
  }
  return {
    ok: true,
    mode: publishMode,
    // PUB-03：postiz_post_id 是 Postiz 的建帖任务 id，平台上真正那条帖子的 id 要等它发完才有
    post_id: postId,
    postiz_post_id: postId,
    platform_post_id: '',
    public_url: String(url || ''),
    // draft 只是躺进 integration 的草稿箱，没发布；计统计时不能算已发
    delivery_state: publishMode === 'draft' ? 'draft' : 'submitted',
    integration: { id: integration.id, identifier, name: integration.name || '' },
  };
}
