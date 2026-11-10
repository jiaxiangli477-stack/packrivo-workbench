import { readFileSync, writeFileSync } from 'node:fs';

/* 1) radar.mjs: 把行业词正则提到模块级，换一批也做本地预过滤 */
const rp = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let rad = readFileSync(rp, 'utf8');
if (!rad.includes('const INDUSTRY_RE')) {
  rad = rad.replace(
    "const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : '');",
    "const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : '');\nconst INDUSTRY_RE = /\\b(packaging|carton|corrugated|kraft|rigid box|mailer box|shipping box|paper box|packaging design)\\b/i;\nconst NOISE_RE = /package manager|linux distro|npm install|apt-get|steam deck|gaming news|hot wheels|magic: the gathering|mtg/i;\nconst industryOk = (s) => INDUSTRY_RE.test(s || '') && !NOISE_RE.test(s || '');"
  );
}
/* buildItems 里对帖子做行业预过滤 */
rad = rad.replace(
  "    posts: uniq(posts).filter((x) => !exclude.has(x.url)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),",
  "    posts: uniq(posts).filter((x) => !exclude.has(x.url)).filter((x) => industryOk((x.title || '') + ' ' + (x.snippet || ''))).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),"
);
writeFileSync(rp, rad, 'utf8');
console.log('radar patched:', rad.includes('INDUSTRY_RE'), rad.includes('industryOk((x.title'));

/* 2) server.mjs: 换一批也走 kimi 质检 */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes("from './quality.mjs'")) {
  s = s.replace(
    "import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';",
    "import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';\nimport { auditContent } from './quality.mjs';"
  );
}
const oldBlock = `  const fresh = batch[scope] || [];
  const usedFallback = fresh.length === 0;
  if (!usedFallback) snap[scope] = fresh;`;
const newBlock = `  let fresh = batch[scope] || [];
  const usedFallback = fresh.length === 0;

  // 换一批也要过 kimi，别把跑题的塞回去
  if (fresh.length) {
    try {
      const ca = await auditContent({
        category: snap.category,
        videos: scope === 'videos' ? fresh : [],
        posts: scope === 'posts' ? fresh : [],
        articles: scope === 'articles' ? fresh : [],
      });
      const map = new Map((ca.items || []).map((x) => [x.id, x]));
      const prefix = scope === 'videos' ? 'v' : scope === 'posts' ? 'p' : 'a';
      fresh = fresh.map((x, i) => {
        const a = map.get(prefix + i);
        return a ? { ...x, ai: { score: a.score, verdict: a.verdict, reason: a.reason } } : x;
      });
    } catch {}
  }
  if (!usedFallback) snap[scope] = fresh;`;
if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  writeFileSync(sp, s, 'utf8');
  console.log('server reroll audit: added');
} else {
  console.log('server reroll anchor MISS');
}
