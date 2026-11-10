import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* buildRadar：硬过滤近 12 个月（日期未知也剔除，避免把 2018 年的视频当热点） */
rep('radar-video-recent',
  `  const allVideos = uniqByUrl(videos);
  const recentVideos = allVideos.filter((v) => v.days <= 365);
  const videosPool = recentVideos.length >= 6 ? recentVideos : allVideos;
  const videosTop = videosPool.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 12);`,
  `  const allVideos = uniqByUrl(videos);
  const recentVideos = allVideos.filter((v) => v.days <= 365);
  const droppedVideos = allVideos.length - recentVideos.length;
  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 12);`);

rep('radar-video-meta',
  `      competitors: sites,
      audit,`,
  `      competitors: sites,
      video_filter: { kept: videosTop.length, dropped_older_or_unknown: droppedVideos, window_days: 365 },
      audit,`);

/* buildItems（换一批）：同样只保留近 12 个月 */
rep('items-video-recent',
  `      const pool = uniq(videos).filter((x) => !exclude.has(x.url));
      const recent = pool.filter((v) => v.days <= 365);
      return (recent.length >= 6 ? recent : pool).sort((a, b) => rank(b) - rank(a)).slice(0, 12);`,
  `      const pool = uniq(videos).filter((x) => !exclude.has(x.url));
      return pool.filter((v) => v.days <= 365).sort((a, b) => rank(b) - rank(a)).slice(0, 12);`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
