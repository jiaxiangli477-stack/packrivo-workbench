import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const r = db.prepare('select id,parent_id,platform,status,image_path,hashtags,length(body) len from content where id=27').get();
console.log(JSON.stringify(r));
const p = db.prepare('select platform,min_tags,max_tags,link_mode,tag_style,text_limit from platform_tag_policy').all();
console.log(JSON.stringify(p));