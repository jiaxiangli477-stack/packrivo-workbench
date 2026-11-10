/* 本地 Postiz 桩（仅批次一断言用）。
   只实现两个公开端点，其余一律 404，绝不联网：
     GET  /api/public/v1/integrations
     POST /api/public/v1/posts
   控制端点（断言脚本用）：
     GET  /__stub/log        返回已记录的请求
     POST /__stub/reset      清空记录、复位行为
     POST /__stub/config     {"next":"ok"|"no-id"|"error-500"}（粘性，改动前一直生效）

   用途：把「有没有真的出站」「出站打到哪个 integration」「Authorization 是否裸 key」变成可断言的记录，
   而不是靠读代码猜。三个 linkedin integration 里 int-C 排最前，专门用来抓「默认取第一个账号」的旧行为。 */

import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 18811);
const EXPECT_KEY = String(process.env.STUB_KEY || '');

const INTEGRATIONS = [
  { id: 'int-C', name: 'C spare', identifier: 'linkedin', disabled: false, profile: 'c' },
  { id: 'int-B', name: 'B page', identifier: 'linkedin', disabled: false, profile: 'b' },
  { id: 'int-A', name: 'A page', identifier: 'linkedin', disabled: false, profile: 'a' },
  { id: 'int-YT', name: 'YT main', identifier: 'youtube', disabled: false, profile: 'yt' },
];

const state = { next: 'ok', seq: 0, log: [] };

function send(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
  res.end(s);
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const p = url.pathname;
    const auth = String(req.headers.authorization || '');

    if (p === '/__stub/log') return send(res, 200, { ok: true, next: state.next, log: state.log });
    if (p === '/__stub/reset') {
      state.log = [];
      state.seq = 0;
      state.next = 'ok';
      return send(res, 200, { ok: true });
    }
    if (p === '/__stub/config') {
      if (body && typeof body.next === 'string') state.next = body.next;
      return send(res, 200, { ok: true, next: state.next });
    }

    if (p === '/api/public/v1/integrations' && req.method === 'GET') {
      state.log.push({ method: 'GET', path: p, auth, at: Date.now() });
      if (EXPECT_KEY && auth !== EXPECT_KEY) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, INTEGRATIONS);
    }

    if (p === '/api/public/v1/posts' && req.method === 'POST') {
      const post = body?.posts?.[0] || {};
      state.log.push({
        method: 'POST',
        path: p,
        auth,
        type: String(body?.type || ''),
        integrationId: String(post?.integration?.id || ''),
        settingsType: String(post?.settings?.__type || ''),
        content: String(post?.value?.[0]?.content || '').slice(0, 120),
        at: Date.now(),
      });
      if (EXPECT_KEY && auth !== EXPECT_KEY) return send(res, 401, { error: 'unauthorized' });
      if (state.next === 'no-id') return send(res, 200, {});           // 云版只回任务号，这里连任务号都不给
      if (state.next === 'error-500') return send(res, 500, { error: 'stub boom' });
      state.seq += 1;
      const taskId = `task-${state.seq}`;
      return send(res, 200, { postId: taskId, releaseURL: `https://stub.local/p/${taskId}` });
    }

    send(res, 404, { error: 'no route', path: p, method: req.method });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stub-postiz] listening 127.0.0.1:${PORT} keyRequired=${EXPECT_KEY ? 'yes' : 'no'}`);
});
