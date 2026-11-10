import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const dup = db.prepare("select id, content_id, run_at, state from schedule where state='pending' and content_id=23").all();
console.log('23 的 pending 排期:', JSON.stringify(dup));
// 保留最早的一条，其余归档
if (dup.length > 1) {
  const keep = dup.sort((a,b)=> a.run_at.localeCompare(b.run_at))[0];
  for (const s of dup) {
    if (s.id !== keep.id) { db.prepare("update schedule set state='archived' where id=?").run(s.id); console.log('archived', s.id, s.run_at); }
  }
  console.log('保留', keep.id, keep.run_at);
}
console.log('剩余 pending:', JSON.stringify(db.prepare("select id,content_id,run_at from schedule where state='pending' order by run_at").all()));