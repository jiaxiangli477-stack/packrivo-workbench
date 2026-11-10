import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '--' };
const dec = (s) => String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&([a-z]+);/gi, (m, n) => (ENT[n] !== undefined ? ENT[n] : m));
const rows = db.prepare("select id,title,body,hashtags,utm_url from content where title like '%&%' or body like '%&amp;%' or utm_url like '%amp%'").all();
for (const r of rows) {
  db.prepare('update content set title=?, body=?, hashtags=? where id=?').run(dec(r.title), dec(r.body), dec(r.hashtags), r.id);
  console.log('fixed content #' + r.id, '->', dec(r.title).slice(0, 60));
}
const hots = db.prepare("select id,title,snippet from hotspot where title like '%&%' or snippet like '%&%'").all();
for (const h of hots) {
  db.prepare('update hotspot set title=?, snippet=? where id=?').run(dec(h.title), dec(h.snippet), h.id);
  console.log('fixed hotspot #' + h.id, '->', dec(h.title).slice(0, 60));
}
console.log('done, contents:', rows.length, 'hotspots:', hots.length);