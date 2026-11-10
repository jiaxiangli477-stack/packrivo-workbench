import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const id = 18;
const url = 'https://www.packrivo.com/product-drawer-jewelry-box/?utm_source=bluesky&utm_campaign=drawer-jb-2610';
const body = 'Drawer jewelry boxes built to your specs: insert sized around your actual rings & chains, pull defined, pre-production sample checked before production.\n\nMOQ 500 pcs per design.\n\n' + url;
const tags = '#JewelryPackaging #PackagingSupplier';
const full = body + '\n\n' + tags;
db.prepare('update content set title=?, body=?, hashtags=?, utm_url=?, status=? where id=?')
  .run('', body, tags, url, 'pending_review', id);
console.log('chars:', full.length);
console.log('----- 将要发布的正文 -----');
console.log(full);