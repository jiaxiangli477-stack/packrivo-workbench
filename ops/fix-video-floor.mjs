import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* buildRadar: 硬门槛 5000 播放，不足 12 条再降到 2000 */
rep('radar-floor',
  `  const within = allVideos.filter((v) => v.days <= 180);
  const views = (v) => Number(v.stats && v.stats.views) || 0;
  const strong = within.filter((v) => views(v) >= 20000);
  const mid = within.filter((v) => views(v) >= 5000);
  const recentVideos = strong.length >= 8 ? strong : (mid.length >= 8 ? mid : within);`,
  `  const within = allVideos.filter((v) => v.days <= 180);
  const views = (v) => Number(v.stats && v.stats.views) || 0;
  const strong = within.filter((v) => views(v) >= 20000);
  const mid = within.filter((v) => views(v) >= 5000);
  const low = within.filter((v) => views(v) >= 2000);
  const recentVideos = strong.length >= 12 ? strong
    : (mid.length >= 12 ? mid
    : (low.length >= 12 ? low : within.filter((v) => views(v) >= 1000)));`);

/* buildItems 同样 */
rep('items-floor',
  `      const pool = uniq(videos).filter((x) => !exclude.has(x.url));
      return pool.filter((v) => v.days <= 365).sort((a, b) => rank(b) - rank(a)).slice(0, 20);`,
  `      const pool = uniq(videos).filter((x) => !exclude.has(x.url)).filter((v) => v.days <= 180);
      const vw = (v) => Number(v.stats && v.stats.views) || 0;
      const pass = pool.filter((v) => vw(v) >= 5000);
      const use = pass.length >= 12 ? pass : pool.filter((v) => vw(v) >= 2000);
      return (use.length ? use : pool).sort((a, b) => rank(b) - rank(a)).slice(0, 20);`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
