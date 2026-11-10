import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';

/* A. 产品图：给产品加 image_path 并填上已下载的实拍图 */
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const cols = db.prepare('PRAGMA table_info(product)').all().map((c) => c.name);
if (!cols.includes('image_path')) db.exec('alter table product add column image_path text');
if (!cols.includes('image_alt')) db.exec('alter table product add column image_alt text');

const map = {
  'PR-DRAWER-JB': ['bsky-drawer-01.jpg', 'Green drawer jewelry box, open drawer with fitted insert holding a ring and necklace'],
  'PR-MAG-JB': ['bsky-magnetic-01.jpg', 'Green rigid magnetic jewelry box, lid open showing a fitted insert with a ring and earrings'],
  'PR-INSERT-JB': ['bsky-insert-01.jpg', 'Jewelry box insert layout: molded pulp and die-cut tray holding rings, necklace and earrings'],
  'PR-LIDBASE-JB': ['bsky-lidbase-01.jpg', 'Lid and base jewelry box in green with a fitted insert holding a necklace and earrings'],
};
const base = 'E:/破甲工作区/social-workbench/data/media/';
for (const [sku, [file, alt]] of Object.entries(map)) {
  db.prepare('update product set image_path = ?, image_alt = ? where sku = ?').run(base + file, alt, sku);
}
console.log('products with image:', db.prepare('select count(*) c from product where image_path is not null').get().c);

/* B. 生成后自动挂产品图；正文里去掉裸链接（走 link card） */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

rep('attach-product-image',
  `    run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), id);`,
  `    run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), id);
    if (product.image_path) {
      run('update content set image_path = ?, image_alt = ? where id = ?', product.image_path, product.image_alt || product.name, id);
    }`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));

/* C. channels：Bluesky 正文剥离裸链接，交给 link card */
const cp = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(cp, 'utf8');
const old = "      const head = [content.title, content.body].filter(Boolean).join('\\n\\n').trim();";
const neu = `      // 链接走 link card，正文里把裸链接和 "View details:" 之类的引导语去掉，空出字符给标签
      const cleanBody = String(content.body || '')
        .replace(/https?:\\/\\/\\S+/g, '')
        .replace(/(view details|see details|details|link|more info)\\s*[:：]\\s*$/i, '')
        .replace(/[ \\t]+\\n/g, '\\n')
        .replace(/\\n{3,}/g, '\\n\\n')
        .trim();
      const head = [content.title, cleanBody].filter(Boolean).join('\\n\\n').trim();`;
if (c.includes(old)) { c = c.replace(old, () => neu); writeFileSync(cp, c, 'utf8'); console.log('channels: link stripped from body'); }
else console.log('channels anchor missing');
