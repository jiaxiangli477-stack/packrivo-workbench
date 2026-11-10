import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/browser.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* 评分解析：取 "4.7 out of 5 stars" 里的 4.7 */
rep('rating-parse',
  "        rating: num(x.rating),",
  "        rating: (() => { const m = String(x.rating || '').match(/([\\d.]+)\\s*out of\\s*5/i); return m ? parseFloat(m[1]) : 0; })(),");

/* 评论数：优先 "1,234 ratings" 文本 */
rep('reviews-parse',
  "          reviews: rev,",
  "          reviews: rev || ((txt.match(/([\\d,]+)\\s*ratings?/i) || [])[1] || ''),");

/* Alibaba 人机验证时重试一次（换 UA/延时） */
rep('alibaba-retry',
  `export async function alibabaSearch(keyword, limit = 8) {
  const slug = String(keyword).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return withPage(async (page) => {`,
  `export async function alibabaSearch(keyword, limit = 8) {
  const slug = String(keyword).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  try {
    return await alibabaOnce(slug, keyword, limit);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 4000));
    try { return await alibabaOnce(slug + '-wholesale', keyword, limit); } catch { throw e; }
  }
}

async function alibabaOnce(slug, keyword, limit = 8) {
  return withPage(async (page) => {`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
