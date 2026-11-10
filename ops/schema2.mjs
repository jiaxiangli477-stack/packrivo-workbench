import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
for (const t of ['ai_analysis']) {
  console.log(t, db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name).join(','));
  console.log('rows', db.prepare(`select count(*) c from ${t}`).get().c);
}