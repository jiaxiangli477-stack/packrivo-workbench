import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

/* 1) 搜索种子：类目整串不再当搜索词，拆词后加 packaging/box */
rep('seeds',
  "  const seeds = [...new Set([category, ...keywords].filter(Boolean))].slice(0, 6);",
  `  // 类目整串（"jewelry, candle & gift packaging"）直接丢给 YouTube 只会搜到娱乐视频，
  // 拆成 token 再补 packaging/box，命中率才正常
  const tokens = String(category || '').split(/[,&/|]+/).map((s) => s.trim()).filter((s) => s.length > 2);
  const derived = tokens.flatMap((t) => [t + ' packaging box', t + ' packaging']);
  const seeds = [...new Set([...keywords, ...derived].filter(Boolean))].slice(0, 6);`);

/* 2) 视频 / 文章：并行抓，154s 压到 40s 左右 */
rep('videos-parallel',
  `  const videos = [];
  for (const seed of seeds.slice(0, 6)) {
    try {
      // HTML 搜索能拿到 "3 weeks ago" 这类发布时间，覆盖比 yt-dlp 高
      let items = [];
      try { items = await searchYouTube(seed, 12); } catch {}
      if (!items.length) items = await searchYouTubeYtdlp(seed, 10);
      videos.push(...items);
    } catch (e) {
      errors.push({ part: 'youtube', seed, error: e.message });
    }
  }`,
  `  const videos = [];
  const videoBatches = await Promise.all(seeds.slice(0, 6).map(async (seed) => {
    try {
      // HTML 搜索能拿到 "3 weeks ago" 这类发布时间，覆盖比 yt-dlp 高
      let items = [];
      try { items = await searchYouTube(seed, 12); } catch {}
      if (!items.length) items = await searchYouTubeYtdlp(seed, 10);
      return items;
    } catch (e) {
      errors.push({ part: 'youtube', seed, error: e.message });
      return [];
    }
  }));
  videos.push(...videoBatches.flat());`);

rep('articles-parallel',
  `  const articles = [];
  for (const seed of seeds.slice(0, 6)) {
    try {
      const res = await searchGoogleNews(\`\${seed} packaging\`, 8);
      articles.push(...res);
    } catch (e) {
      errors.push({ part: 'news', seed, error: e.message });
    }
  }`,
  `  const articles = [];
  const newsBatches = await Promise.all(seeds.slice(0, 6).map(async (seed) => {
    try {
      return await searchGoogleNews(\`\${seed} packaging\`, 8);
    } catch (e) {
      errors.push({ part: 'news', seed, error: e.message });
      return [];
    }
  }));
  articles.push(...newsBatches.flat());`);

/* 3) 质检全判 drop 时，保留分数最高的几条并标注，别让页面空白 */
rep('audit-fallback',
  "    const scoreMap = new Map(audit.items.map((x) => [x.id, x]));",
  `    // kimi 可能把整批都判 drop（搜索词太泛时常见）。此时保留分数最高的几条并标注"低相关保留"，
    // 否则页面只剩一个空状态，用户无法判断是没抓到还是被过滤了
    const allDrop = audit.items.length > 0 && audit.items.every((x) => x.verdict !== 'keep');
    if (allDrop) {
      const ranked = [...audit.items].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
      ranked.slice(0, 8).forEach((x, i) => {
        if (i < 8 && (Number(x.score) || 0) >= 10) {
          x.verdict = 'keep';
          x.reason = '低相关保留（' + (x.reason || '').slice(0, 60) + '）';
        }
      });
      audit.summary = (audit.summary || '') + '｜全部判 drop，已保留分数最高 8 条供参考';
    }
    const scoreMap = new Map(audit.items.map((x) => [x.id, x]));`);

writeFileSync(p, c, 'utf8');
console.log('patched:', done.join(', '));
