import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const r = db.prepare("select target_kind,target_id,mode,substr(payload,1,300) p from ai_analysis order by id desc limit 2").all();
console.log(JSON.stringify(r, null, 1));