import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const row = db.prepare("select cipher from credential where owner_kind='account' and owner_id=4 and field='app_password' order by id desc limit 1").get();
const { decrypt } = await import('../app/crypto.mjs');
const pw = decrypt(row.cipher);

const sess = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'packrivo.bsky.social', password: pw }),
}).then((r) => r.json());
console.log('session did:', sess.did, 'handle:', sess.handle);

const posts = ['3myqqmli2cm2z', '3myqqmmbgcv2a'];
for (const rkey of posts) {
  const uri = 'at://' + sess.did + '/app.bsky.feed.post/' + rkey;
  const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then((r) => r.json());
  const p = (j.posts || [])[0];
  console.log(rkey, '| text:', (p?.record?.text || '').slice(0, 60).replace(/\s+/g, ' '), '| embed:', p?.embed?.$type || p?.record?.embed?.$type || 'none', '| likes:', p?.likeCount);
}

/* 删掉重复的那条（保留 3myqqmli2cm2z） */
const del = await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sess.accessJwt },
  body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', rkey: '3myqqmmbgcv2a' }),
});
console.log('delete duplicate status:', del.status, (await del.text()).slice(0, 120));
