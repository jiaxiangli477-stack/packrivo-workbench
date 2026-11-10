import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const { decrypt } = await import('../app/crypto.mjs');
const BASE = 'http://127.0.0.1:8795';

const pwRow = db.prepare("select cipher from credential where owner_kind='account' and owner_id=4 and field='app_password' order by id desc limit 1").get();
const sess = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'packrivo.bsky.social', password: decrypt(pwRow.cipher) }),
}).then((r) => r.json());

const TAGS = '#JewelryPackaging #PackagingDesign #CustomPackaging #SmallBusiness';

/* 找出要重发的两条 */
const targets = db.prepare("select id, hashtags from content where id in (18, 22)").all();
for (const t of targets) {
  const urls = db.prepare("select url from publish_result where content_id = ? and ok = 1 and url like 'https://bsky.app/%'").all(t.id);
  for (const u of urls) {
    const rkey = String(u.url).split('/').pop();
    const del = await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sess.accessJwt },
      body: JSON.stringify({ repo: sess.did, collection: 'app.bsky.feed.post', rkey }),
    });
    console.log('content', t.id, 'delete', rkey, del.status);
  }
  db.prepare("update content set hashtags=?, status='approved' where id=?").run(TAGS, t.id);
  db.prepare("update schedule set state='archived' where content_id=?").run(t.id);
  console.log('content', t.id, 'tags ->', TAGS);
}

/* 重新排期并发布 */
for (const t of targets) {
  const sched = await fetch(BASE + '/api/schedules', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content_id: t.id, account_id: 4, channel: 'bluesky' }),
  }).then((r) => r.json());
  console.log('schedule', sched.id, 'for content', t.id);
}

for (let i = 0; i < 3; i++) {
  await fetch(BASE + '/api/tick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  await new Promise((r) => setTimeout(r, 1500));
}

const feed = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=packrivo.bsky.social&limit=10').then((r) => r.json());
console.log('--- 线上 ---');
for (const f of feed.feed || []) {
  const p = f.post;
  console.log(p.uri.split('/').pop(), '|', p.record.text.slice(0, 40).replace(/\s+/g, ' '), '| 图:', p.embed?.$type || 'none');
  console.log('   tags:', (p.record.text.match(/#\w+/g) || []).join(' '));
}
