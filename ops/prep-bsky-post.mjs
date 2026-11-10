import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const id = 18;
const utm = 'https://www.packrivo.com/product-drawer-jewelry-box/?utm_source=bluesky&utm_medium=social&utm_campaign=custom-drawer-jewelry-box-2610&utm_content=c' + id;
db.prepare('update content set utm_url = ?, status = ?, account_id = 4 where id = ?').run(utm, 'pending_review', id);
const row = db.prepare('select id, platform, title, body, hashtags, utm_url, status from content where id = ?').get(id);
console.log(JSON.stringify(row, null, 2));
const text = [row.title, row.body, row.hashtags, row.utm_url].filter(Boolean).join('\n\n');
console.log('total chars (rough):', text.length);