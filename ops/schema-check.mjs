import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/workbench.db');
for (const t of ['content','schedule','publish_result','metric','kb_item','radar_snapshot']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name).join(',');
  const n = db.prepare(`select count(*) c from ${t}`).get().c;
  console.log(t, '| rows', n, '|', cols.slice(0, 160));
}
const st = db.prepare("select status, count(*) c from content group by status").all();
console.log('content status:', JSON.stringify(st));