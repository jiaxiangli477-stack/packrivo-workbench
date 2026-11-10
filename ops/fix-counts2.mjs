import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* 视频/文章：6 个种子词，每个取 12 条 */
rep('videos-6seeds', '  for (const seed of seeds.slice(0, 4)) {\n    try {\n      // HTML 搜索能拿到', '  for (const seed of seeds.slice(0, 6)) {\n    try {\n      // HTML 搜索能拿到');
rep('articles-6seeds', '  for (const seed of seeds.slice(0, 3)) {\n    try {\n      const res = await searchGoogleNews', '  for (const seed of seeds.slice(0, 6)) {\n    try {\n      const res = await searchGoogleNews');

/* 帖子：更多标签 + 更多 Bluesky 查询 + 门槛降到 2 */
rep('tags-more', "  const tags = [...new Set(['jewelrybox', 'candlepackaging', 'giftbox', 'packaging', 'jewelrypackaging'])].slice(0, 5);",
  "  const tags = [...new Set(['jewelrybox', 'jewelrypackaging', 'candlepackaging', 'candlebox', 'giftbox', 'giftwrapping', 'packaging', 'unboxing'])].slice(0, 8);");
rep('bluesky-more', "    try { posts.push(...(await searchBluesky(`${seed} packaging`, 12))); } catch (e) { errors.push({ part: 'bluesky', seed, error: e.message }); }",
  "    for (const q of [`${seed} packaging`, `${seed} box`]) {\n      try { posts.push(...(await searchBluesky(q, 12))); } catch (e) { errors.push({ part: 'bluesky', seed: q, error: e.message }); }\n    }");
rep('threshold', "filter((x) => eng(x) >= (x.platform === 'lemmy' ? 10 : 3))", "filter((x) => eng(x) >= (x.platform === 'lemmy' ? 8 : 2))");

/* 帖子最终取 20 */
rep('posts-20', "      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),\n      articles:", "      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),\n      articles:");

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
