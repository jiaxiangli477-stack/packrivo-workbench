import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 1) HTML 实体还原（修同行名称乱码） */
rep('decode-helper',
  "const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : '');",
  `const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : '');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', copy: '©', reg: '®', trade: '™' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
}`);

rep('decode-use',
  `  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim() : '';
  };`,
  `  const pick = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim()) : '';
  };`);

rep('decode-posts',
  `    posts = titles.slice(0, 5);`,
  `    posts = titles.map((t) => decodeEntities(t)).slice(0, 5);`);

/* 2) 视频：只保留近 12 个月优先，DIY/手工降权 */
rep('video-filter',
  `  const videosTop = uniqByUrl(videos).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12);`,
  `  const DIY = /\\b(diy|handmade|hand-made|craft|at home)\\b/i;
  const rankScore = (v) => {
    let s = Number(v.score) || 0;
    if (DIY.test(v.title || '')) s -= 12;          // DIY 手工类降权
    if (v.days > 365) s -= 40;                      // 超过 12 个月大幅降权
    return s;
  };
  const allVideos = uniqByUrl(videos);
  const recentVideos = allVideos.filter((v) => v.days <= 365);
  const videosPool = recentVideos.length >= 6 ? recentVideos : allVideos;
  const videosTop = videosPool.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 12);`);

/* 3) 换一批路径同样处理 */
rep('video-filter-items',
  `    videos: uniq(videos).filter((x) => !exclude.has(x.url)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),`,
  `    videos: (() => {
      const DIYRE = /\\b(diy|handmade|hand-made|craft|at home)\\b/i;
      const rank = (v) => (Number(v.score) || 0) - (DIYRE.test(v.title || '') ? 12 : 0) - (v.days > 365 ? 40 : 0);
      const pool = uniq(videos).filter((x) => !exclude.has(x.url));
      const recent = pool.filter((v) => v.days <= 365);
      return (recent.length >= 6 ? recent : pool).sort((a, b) => rank(b) - rank(a)).slice(0, 12);
    })(),`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
