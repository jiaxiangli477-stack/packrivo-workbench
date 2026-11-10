import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
console.log('总稿件:', db.prepare('select count(*) c from content').get().c, '| 带图:', db.prepare('select count(*) c from content where image_path is not null').get().c);
console.log('待审:', db.prepare("select count(*) c from content where status='pending_review'").get().c);