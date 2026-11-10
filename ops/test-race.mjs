import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const BASE = 'http://127.0.0.1:8795';

/* 建测试内容 + 排期（mock 通道） */
const content = await fetch(BASE + '/api/contents', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ platform: 'mastodon', title: 'RACE TEST 2', body: 'race test 2', hashtags: '' }),
}).then((r) => r.json());

const sched = await fetch(BASE + '/api/schedules', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content_id: content.id, account_id: 3, channel: 'mock' }),
}).then((r) => r.json());

console.log('content', content.id, 'schedule', sched.id);

/* 5 个并发 tick */
await Promise.all(Array.from({ length: 5 }, () =>
  fetch(BASE + '/api/tick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
));

await new Promise((r) => setTimeout(r, 1500));

const rows = db.prepare('select id, channel, ok from publish_result where content_id = ?').all(content.id);
console.log('publish_result 条数:', rows.length, JSON.stringify(rows));
console.log(rows.length === 1 ? 'PASS 只发了一次' : 'FAIL 重复发布！');

/* 清理测试数据 */
db.prepare('delete from publish_result where content_id = ?').run(content.id);
db.prepare('delete from job where payload like ?').run('%' + sched.id + '%');
db.prepare('delete from schedule where id = ?').run(sched.id);
db.prepare('delete from content where id = ?').run(content.id);
console.log('清理完成');

/* 线上帖子核对 */
const pwRow = db.prepare("select cipher from credential where owner_kind='account' and owner_id=4 and field='app_password' order by id desc limit 1").get();
const { decrypt } = await import('../app/crypto.mjs');
const sess = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'packrivo.bsky.social', password: decrypt(pwRow.cipher) }),
}).then((r) => r.json());

for (const rkey of ['3myqqmli2cm2z', '3myqqmmbgcv2a']) {
  const uri = 'at://' + sess.did + '/app.bsky.feed.post/' + rkey;
  const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then((r) => r.json());
  const p = (j.posts || [])[0];
  console.log(rkey, p ? '存在 | 图片: ' + (p.embed?.$type || p.embed?.images ? 'yes' : 'no') : '已删除');
}
