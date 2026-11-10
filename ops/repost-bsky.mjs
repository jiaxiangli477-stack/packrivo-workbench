import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const { decrypt } = await import('../app/crypto.mjs');

const pwRow = db.prepare("select cipher from credential where owner_kind='account' and owner_id=4 and field='app_password' order by id desc limit 1").get();
const sess = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'packrivo.bsky.social', password: decrypt(pwRow.cipher) }),
}).then((r) => r.json());

const del = await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sess.accessJwt },
  body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', rkey: '3myqqmli2cm2z' }),
});
console.log('删除旧帖（无链接版）:', del.status);

/* 重置内容为可再发 */
db.prepare("update content set status='approved' where id=18").run();
db.prepare("update schedule set state='archived' where content_id=18").run();
console.log('content #18 已重置为 approved');
console.log('剩余线上帖子数:', await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=packrivo.bsky.social&limit=10').then((r) => r.json()).then((j) => (j.feed || []).length));
