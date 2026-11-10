import { readFileSync, writeFileSync } from 'node:fs';

/* radar */
const rp = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let r = readFileSync(rp, 'utf8');
const rd = [];
const rrep = (n, a, b) => { if (!r.includes(a)) { console.log('MISS', n); return; } r = r.replace(a, b); rd.push(n); };
rrep('sites-24', 'const siteList = [...new Set(competitors)].slice(0, 20);', 'const siteList = [...new Set(competitors)].slice(0, 24);');
rrep('tags-12', "const tags = [...new Set(['jewelrybox', 'jewelrypackaging', 'candlepackaging', 'candlebox', 'giftbox', 'giftwrapping', 'packaging', 'unboxing'])].slice(0, 8);",
  "const tags = [...new Set(['jewelrybox', 'jewelrypackaging', 'candlepackaging', 'candlebox', 'candlemaking', 'giftbox', 'giftwrapping', 'packaging', 'unboxing', 'smallbusiness', 'jewelrydesign', 'handmadebusiness'])].slice(0, 12);");
rrep('threshold-1', "filter((x) => eng(x) >= (x.platform === 'lemmy' ? 8 : 2))", "filter((x) => eng(x) >= (x.platform === 'lemmy' ? 6 : 1))");
writeFileSync(rp, r, 'utf8');
console.log('radar done:', rd.join(', '));

/* sources: YouTube 搜索加「今年」过滤 + 每词 20 条；Mastodon 抓更多 */
const sp = 'E:/破甲工作区/social-workbench/app/sources.mjs';
let s = readFileSync(sp, 'utf8');
const sd = [];
const srep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, b); sd.push(n); };
srep('yt-this-year', 'const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=EgIQAQ%253D%253D`);',
  'const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=EgQIBRAB%253D%253D`);');
srep('yt-limit', 'export async function searchYouTube(keyword, limit = 6) {', 'export async function searchYouTube(keyword, limit = 20) {');
writeFileSync(sp, s, 'utf8');
console.log('sources done:', sd.join(', '));
