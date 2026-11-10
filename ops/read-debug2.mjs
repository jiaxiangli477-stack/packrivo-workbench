import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
console.log('cols:', db.prepare('PRAGMA table_info(audit_log)').all().map(c=>c.name).join(','));
const rows = db.prepare("select * from audit_log where action='rewrite.debug' order by id desc limit 3").all();
for (const r of rows) console.log(JSON.stringify(r).slice(0, 700));