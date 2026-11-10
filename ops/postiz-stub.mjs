/* Postiz 公开 API v1 契约桩 —— 只用于本机联调与自测，不替代真 Postiz。
   路由、鉴权头、请求体校验都按 gitroomhq/postiz-docs/public-api/openapi.json（2026-10-26）实现：
     GET  /api/public/v1/integrations    Authorization: <api key>
     GET  /api/public/v1/me
     POST /api/public/v1/posts
   真自建 Postiz 起来后，把设置里的 Base URL 换成它、Key 换成真 Key 就行，代码不用改。 */
import http from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.POSTIZ_STUB_PORT || 8798);
const KEY = process.env.POSTIZ_STUB_KEY || 'stub-key-123';
const LOG = path.join(import.meta.dirname, '..', 'data', 'postiz-stub.jsonl');
mkdirSync(path.dirname(LOG), { recursive: true });

const INTEGRATIONS = [
  { id: 'int-x-0001', name: 'Packrivo X', identifier: 'x', profile: 'packrivo', disabled: false, customer: { id: 'c1', name: 'Packrivo' } },
  { id: 'int-fb-0002', name: 'Packrivo Page', identifier: 'facebook', profile: 'packrivo', disabled: false, customer: { id: 'c1', name: 'Packrivo' } },
  { id: 'int-li-0003', name: 'Packrivo Company', identifier: 'linkedin-page', profile: 'packrivo', disabled: false, customer: { id: 'c1', name: 'Packrivo' } },
  { id: 'int-ig-0004', name: 'Packrivo IG', identifier: 'instagram', profile: 'packrivo', disabled: false, customer: { id: 'c1', name: 'Packrivo' } },
  { id: 'int-tt-0005', name: 'Packrivo TikTok', identifier: 'tiktok', profile: 'packrivo', disabled: false, customer: { id: 'c1', name: 'Packrivo' } },
];

const received = [];
let seq = 0;

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function authOk(req) {
  // Postiz 收的是裸 key，不是 Bearer
  return (req.headers.authorization || '') === KEY;
}

function validatePost(body) {
  const errs = [];
  if (!['now', 'schedule', 'draft'].includes(body?.type)) errs.push('type 必须是 now/schedule/draft');
  if (body?.type !== 'now' && !body?.date) errs.push('date 必填');
  if (typeof body?.shortLink !== 'boolean') errs.push('shortLink 必须是 boolean');
  if (!Array.isArray(body?.tags)) errs.push('tags 必须是数组');
  if (body?.type !== 'draft') {
    if (!Array.isArray(body?.posts) || !body.posts.length) errs.push('posts 必填');
    for (const p of body?.posts || []) {
      if (!p?.integration?.id) errs.push('posts[].integration.id 必填');
      if (!Array.isArray(p?.value) || !p.value.length) errs.push('posts[].value 必填');
      if (!p?.settings?.__type) errs.push('posts[].settings.__type 必填');
      if (p?.settings?.__type === 'tiktok') {
        for (const f of ['privacy_level', 'duet', 'stitch', 'comment', 'autoAddMusic', 'brand_content_toggle', 'brand_organic_toggle', 'content_posting_method']) {
          if (p.settings[f] === undefined) errs.push('tiktok 缺少 settings.' + f);
        }
      }
      if (p?.settings?.__type === 'youtube' && (!p.settings.title || !p.settings.type)) errs.push('youtube 缺少 settings.title/type');
      if (p?.settings?.__type === 'pinterest' && !p.settings.board) errs.push('pinterest 缺少 settings.board');
    }
  }
  return errs;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/__stub/log' && req.method === 'GET') return send(res, 200, { received });
  if (p === '/__stub/reset' && req.method === 'POST') { received.length = 0; return send(res, 200, { ok: true }); }

  if (!p.startsWith('/api/public/v1/')) return send(res, 404, { msg: 'not found: ' + p });
  if (!authOk(req)) return send(res, 401, { msg: 'Unauthorized' });

  if (p === '/api/public/v1/me' && req.method === 'GET') {
    return send(res, 200, { id: 'org-packrivo', name: 'Packrivo', email: 'ops@packrivo.local' });
  }

  if (p === '/api/public/v1/integrations' && req.method === 'GET') {
    return send(res, 200, INTEGRATIONS);
  }

  if (p === '/api/public/v1/posts' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return send(res, 400, { msg: 'invalid json' }); }

    const errs = validatePost(body);
    received.push({ at: new Date().toISOString(), body, errs });
    appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), body, errs }) + '\n');
    if (errs.length) return send(res, 400, { msg: errs.join('; ') });

    seq += 1;
    const out = (body.posts || []).map((post) => ({
      postId: `stub-${seq}-${post.integration.id}`,
      integration: post.integration.id,
      releaseURL: body.type === 'draft' ? '' : `https://stub.local/p/${seq}`,
    }));
    return send(res, 200, out);
  }

  return send(res, 404, { msg: 'not found: ' + p });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[postiz-stub] http://127.0.0.1:${PORT}  key=${KEY}  channels=${INTEGRATIONS.length}`);
});
