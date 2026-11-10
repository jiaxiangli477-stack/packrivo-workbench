import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

/* 视频先做一道相关性过滤：泛词（jewelry box / gift box）会带来大量娱乐视频 */
rep('video-filter',
  "  const allVideos = uniqByUrl(videos);",
  `  // 泛词搜索会把 storage unit 寻宝、squishy 盲盒这类娱乐视频带进来，先按行业词过滤再交给质检
  const VIDEO_RELEVANT = /packaging|package|packaging design|carton|corrugated|kraft|paper box|rigid box|printed box|mailer|insert|foam|box manufactur/i;
  const VIDEO_NOISE = /lyrics|visualizer|official (music )?video|gameplay|unboxing (haul|prank)|squishy|storage unit/i;
  const relevantVideos = videos.filter((v) => {
    const hay = (v.title || '') + ' ' + (v.snippet || '');
    return VIDEO_RELEVANT.test(hay) && !VIDEO_NOISE.test(hay);
  });
  const allVideos = uniqByUrl(relevantVideos.length >= 6 ? relevantVideos : videos);`);

/* 质检全 drop 时的兜底阈值放宽到 8 分，保留 6 条 */
rep('fallback-threshold',
  "      ranked.slice(0, 8).forEach((x, i) => {\n        if (i < 8 && (Number(x.score) || 0) >= 10) {",
  "      ranked.slice(0, 6).forEach((x, i) => {\n        if (i < 6 && (Number(x.score) || 0) >= 8) {");

writeFileSync(p, c, 'utf8');
console.log('patched:', done.join(', '));
