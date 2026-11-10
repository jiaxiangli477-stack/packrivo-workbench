import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* 行业词放宽：首饰/蜡烛/礼盒/开箱 也算相关（B2B 包装的买家素材） */
rep('industry-widen',
  "const INDUSTRY_RE = /\\b(packaging|carton|corrugated|kraft|rigid box|mailer box|shipping box|paper box|packaging design)\\b/i;",
  "const INDUSTRY_RE = /\\b(packaging|carton|corrugated|kraft|rigid box|mailer box|shipping box|paper box|packaging design|jewelry box|candle|gift box|unboxing|jewelry packaging|pouch)\\b/i;");

/* Bluesky：固定一组高相关查询，取更多 */
rep('bluesky-queries',
  "  for (const seed of seeds.slice(0, 2)) {\n    for (const q of [`${seed} packaging`, `${seed} box`]) {\n      try { posts.push(...(await searchBluesky(q, 12))); } catch (e) { errors.push({ part: 'bluesky', seed: q, error: e.message }); }\n    }\n  }",
  "  {\n    const queries = ['jewelry box packaging', 'jewelry packaging', 'candle packaging', 'gift box packaging', 'unboxing jewelry', 'packaging design', 'custom packaging'];\n    for (const q of queries) {\n      try { posts.push(...(await searchBluesky(q, 12))); } catch (e) { errors.push({ part: 'bluesky', seed: q, error: e.message }); }\n    }\n  }");

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
