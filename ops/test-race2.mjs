import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const BASE = 'http://127.0.0.1:8795';

console.log('setting cols:', db.prepare('PRAGMA table_info(setting)').all().map(x=>x.name).join(','));

const content = await fetch(BASE + '/api/contents', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ platform: 'mastodon', title: 'RACE TEST 3', body: 'race 3', hashtags: '' }),
}).then((r) => r.json());
db.prepare("update content set status='approved' where id=?").run(content.id);

const sched = await fetch(BASE + '/api/schedules', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content_id: content.id, account_id: 3, channel: 'mock' }),
}).then((r) => r.json());
console.log('content', content.id, 'status approved, schedule', sched.id, 'state', db.prepare('select state from schedule where id=?').get(sched.id).state);

const ticks = await Promise.all(Array.from({ length: 5 }, () =>
  fetch(BASE + '/api/tick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json())
));
console.log('tick 返回:', JSON.stringify(ticks));
await new Promise((r) => setTimeout(r, 1500));

const rows = db.prepare('select id, channel, ok, platform_post_id from publish_result where content_id = ?').all(content.id);
console.log('publish_result 条数:', rows.length, JSON.stringify(rows));
console.log(rows.length === 1 ? 'PASS 只发一次' : (rows.length === 0 ? 'FAIL 没发出去' : 'FAIL 重复'));
console.log('schedule state:', db.prepare('select state from schedule where id=?').get(sched.id).state);
console.log('job:', JSON.stringify(db.prepare("select id,state,last_error from job order by id desc limit 2").all()));

db.prepare('delete from publish_result where content_id = ?').run(content.id);
db.prepare('delete from job where payload like ?').run('%' + sched.id + '%');
db.prepare('delete from schedule where id = ?').run(sched.id);
db.prepare('delete from content where id = ?').run(content.id);
console.log('cleaned');
