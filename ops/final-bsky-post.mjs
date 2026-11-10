import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const id = 18;

const url = 'https://www.packrivo.com/product-drawer-jewelry-box/?utm_source=bluesky';
const tags = '#PackagingSupplier';

const variants = [
  `3 things decide a drawer jewelry box quote before anyone prices it:
1) insert: foam, molded pulp, or hand-glued
2) pull: ribbon tab, notch, or metal
3) assembled or flat

Name all three and quotes become comparable. MOQ 500 pcs per design.`,
  `3 things decide a drawer box quote:
1) insert: foam, pulp, or hand-glued
2) pull: ribbon tab, notch, or metal
3) assembled or flat

Name all three, quotes become comparable. MOQ 500 pcs per design.`,
];

let chosen = null;
for (const v of variants) {
  const full = v + '\n' + url + '\n' + tags;
  if (full.length <= 300) { chosen = { body: v, tags, full }; break; }
}
if (!chosen) {
  const v = variants[1];
  chosen = { body: v, tags: '', full: v + '\n' + url };
  if (chosen.full.length > 300) throw new Error('还是超了: ' + chosen.full.length);
}

db.prepare('update content set title=?, body=?, hashtags=?, utm_url=?, image_path=?, image_alt=?, status=? where id=?')
  .run('', chosen.body, chosen.tags, url,
    'E:/破甲工作区/social-workbench/data/media/bsky-drawer-01.jpg',
    'Custom drawer jewelry box with fitted insert, open drawer showing ring and chain compartments',
    'approved', id);

console.log('字符数:', chosen.full.length, '/ 300');
console.log('----- 最终正文 -----');
console.log(chosen.full);
const row = db.prepare('select id, platform, status, image_path, image_alt from content where id=?').get(id);
console.log('----- 记录 -----');
console.log(JSON.stringify(row));
