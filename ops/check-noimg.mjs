import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const noimg = db.prepare("select id, platform, status, substr(title,1,46) t from content where status in ('pending_review','approved','draft') and (image_path is null or image_path = '') order by id desc").all();
console.log('缺图稿件:', noimg.length);
console.log(JSON.stringify(noimg, null, 1));
console.log('待审:', db.prepare("select count(*) c from content where status='pending_review'").get().c, '| 带图:', db.prepare('select count(*) c from content where image_path is not null').get().c, '| 总数:', db.prepare('select count(*) c from content').get().c);