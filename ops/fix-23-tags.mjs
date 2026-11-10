import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const tags = '#JewelryPackaging #PackagingDesign #SmallBusiness #Unboxing';
db.prepare('update content set hashtags=? where id=?').run(tags, 23);
console.log('content 23 tags ->', tags);
const r = db.prepare('select id, platform, hashtags, status from content where id in (22,23)').all();
console.log(JSON.stringify(r));