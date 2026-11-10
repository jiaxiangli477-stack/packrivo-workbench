import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const old = "results: all(`select r.*, c.title, c.platform from publish_result r left join content c on c.id = r.content_id order by r.id desc limit 200`),";
const neu = "results: all(`select r.*, c.title, c.body, c.image_path, c.hashtags, c.platform, c.utm_url,\n    (select sum(m.likes) from metric m where m.content_id = c.id) as likes,\n    (select sum(m.comments) from metric m where m.content_id = c.id) as replies,\n    (select sum(m.shares) from metric m where m.content_id = c.id) as reposts\n    from publish_result r left join content c on c.id = r.content_id order by r.id desc limit 200`),";
if (!c.includes(old)) { console.log('MISS'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('results query extended');