import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const row = db.prepare('select payload from radar_snapshot where id = 1').get();
if (!row) { console.log('no snapshot'); process.exit(1); }
const snap = JSON.parse(row.payload);
const vs = snap.videos || [];
const views = (v) => Number(v.stats && v.stats.views) || 0;
const pass5 = vs.filter((v) => views(v) >= 5000);
const pass2 = vs.filter((v) => views(v) >= 2000);
const keep = pass5.length >= 12 ? pass5 : (pass2.length >= 12 ? pass2 : pass2);
snap.videos = keep.slice(0, 20);
snap.video_filter = { ...(snap.video_filter || {}), kept: snap.videos.length, min_views: pass5.length >= 12 ? 5000 : 2000 };
db.prepare('update radar_snapshot set payload = ? where id = 1').run(JSON.stringify(snap));
console.log('videos kept', snap.videos.length, 'min views', snap.video_filter.min_views);
console.log(snap.videos.map((v) => views(v)).join(','));
