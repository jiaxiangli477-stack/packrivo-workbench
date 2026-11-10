import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const rows = db.prepare("select detail, created_at from audit_log where action='rewrite.debug' order by id desc limit 2").all();
for (const r of rows) console.log(r.created_at, '|', String(r.detail).slice(0, 500));