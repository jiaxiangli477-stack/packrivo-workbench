import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/workbench.db');
const r = db.prepare('select id, title, body, hashtags, utm_url, status from content where id=18').get();
console.log(JSON.stringify(r, null, 2));
console.log('body 长度:', (r.body||'').length);
console.log('含 URL:', (r.body||'').includes('http'));