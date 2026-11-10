import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const rows = db.prepare("select id, platform, status, image_path is not null as has_img, substr(title,1,40) t from content where status in ('pending_review','approved','draft') order by id desc limit 14").all();
console.log(JSON.stringify(rows, null, 1));
console.log('with image:', db.prepare('select count(*) c from content where image_path is not null').get().c);