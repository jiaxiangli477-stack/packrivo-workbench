import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const old = "  ['overview', '概览'], ['videos', '视频'], ['posts', '帖子'], ['articles', '文章'],\n  ['keywords', '关键词'], ['competitors', '同行网站'], ['sources', '来源状态'],";
const neu = "  ['overview', '概览'], ['videos', '视频'], ['posts', '帖子'], ['articles', '文章'], ['products', '商品'],\n  ['keywords', '关键词'], ['competitors', '同行网站'], ['sources', '来源状态'],";
if (!c.includes(old)) { console.log('MISS'); process.exit(1); }
c = c.replace(old, neu);
writeFileSync(p, c, 'utf8');
console.log('tabs added');