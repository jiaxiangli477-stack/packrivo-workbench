import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- channels.mjs: 直连 Mastodon / Bluesky ---------- */
const p = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(p, 'utf8');

if (!c.includes("import { get } from './db.mjs'")) {
  c = c.replace(
    "import { setting } from './db.mjs';",
    "import { setting, get, run } from './db.mjs';\nimport { decrypt } from './crypto.mjs';"
  );
}

if (!c.includes('mastodon: {')) {
  const block = `
/* 账凭据读取：同名字段取最新一条并解密 */
function cred(accountId, field) {
  if (!accountId) return null;
  const row = get(
    "select cipher from credential where owner_kind = 'account' and owner_id = ? and field = ? order by id desc limit 1",
    accountId, field
  );
  if (!row) return null;
  try { return decrypt(row.cipher); } catch { return null; }
}

function postText(content) {
  return [content.title, content.body, content.hashtags].filter(Boolean).join('\\n\\n').trim();
}

export const channels = {`;
  c = c.replace('export const channels = {', block);

  const direct = `
  /* 直连 Mastodon：不需要任何平台审核，填实例地址 + access token 即可发 */
  mastodon: {
    label: 'Mastodon（直连）',
    get state() { return 'ready'; },
    note: '在账号页填「实例域名」和「access token」；发布走 /api/v1/statuses',
    async publish({ content, account }) {
      const id = account?.id;
      const instance = cred(id, 'instance') || (account?.profile_url || '').replace(/^https?:\\/\\//, '').split('/')[0];
      const token = cred(id, 'access_token');
      if (!instance || !token) throw new PublishError('pending_config', 'Mastodon 未配置：需要 instance 与 access_token');
      const r = await postJson(
        'https://' + instance.replace(/\\/$/, '') + '/api/v1/statuses',
        { status: postText(content).slice(0, 4000), visibility: 'public' },
        { authorization: 'Bearer ' + token }
      );
      if (r.status < 200 || r.status >= 300) throw new PublishError('upstream_error', 'Mastodon 返回 ' + r.status, r.text.slice(0, 300));
      const j = JSON.parse(r.text || '{}');
      return { ok: true, post_id: String(j.id || ''), url: j.url || '' };
    },
  },

  /* 直连 Bluesky：app password + handle，走 AT Protocol */
  bluesky: {
    label: 'Bluesky（直连）',
    get state() { return 'ready'; },
    note: '在账号页填「handle」和「app password」；发布走 com.atproto.repo.createRecord',
    async publish({ content, account }) {
      const id = account?.id;
      const handle = cred(id, 'handle') || account?.handle?.replace(/^@/, '');
      const password = cred(id, 'app_password');
      if (!handle || !password) throw new PublishError('pending_config', 'Bluesky 未配置：需要 handle 与 app_password');

      const sess = await postJson('https://bsky.social/xrpc/com.atproto.server.createSession', { identifier: handle, password });
      if (sess.status < 200 || sess.status >= 300) throw new PublishError('auth_failed', 'Bluesky 登录失败 ' + sess.status, sess.text.slice(0, 200));
      const s = JSON.parse(sess.text);

      let text = postText(content);
      if (text.length > 300) text = text.slice(0, 297) + '...';

      const rec = {
        repo: s.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() },
      };
      const res = await postJson('https://bsky.social/xrpc/com.atproto.repo.createRecord', rec, { authorization: 'Bearer ' + s.accessJwt });
      if (res.status < 200 || res.status >= 300) throw new PublishError('upstream_error', 'Bluesky 发布失败 ' + res.status, res.text.slice(0, 200));
      const j = JSON.parse(res.text || '{}');
      const rkey = String(j.uri || '').split('/').pop();
      return { ok: true, post_id: rkey, url: 'https://bsky.app/profile/' + handle + '/post/' + rkey };
    },
  },
`;
  c = c.replace("  postiz: {", direct + "\n  postiz: {");
  writeFileSync(p, c, 'utf8');
  console.log('channels: mastodon + bluesky direct added');
} else {
  console.log('channels already patched');
}
