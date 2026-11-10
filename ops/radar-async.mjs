import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- 1) radar.mjs: 阶段回调 ---------- */
const rp = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let r = readFileSync(rp, 'utf8');
const rdone = [];
const rrep = (n, a, b) => { if (!r.includes(a)) { console.log('MISS radar.' + n); return; } r = r.replace(a, () => b); rdone.push(n); };

rrep('sig', "export async function buildRadar({ category, keywords = [], competitors = [], market = 'us', videosPer = 4 })",
  "export async function buildRadar({ category, keywords = [], competitors = [], market = 'us', videosPer = 4, onStage = null }) {\n  const stage = (s) => { try { onStage && onStage(s); } catch {} };");

rrep('stage-kw', "  const kwGroups = await Promise.all(seeds.map(async (seed) => {", "  stage('关键词联想');\n  const kwGroups = await Promise.all(seeds.map(async (seed) => {");
rrep('stage-video', "  const videos = [];\n  const videoBatches", "  stage('热门视频');\n  const videos = [];\n  const videoBatches");
rrep('stage-news', "  const articles = [];\n  const newsBatches", "  stage('热门文章');\n  const articles = [];\n  const newsBatches");
rrep('stage-posts', "  const posts = [];\n  const tags =", "  stage('社区帖子');\n  const posts = [];\n  const tags =");
rrep('stage-products', "  let products = [];", "  stage('商品比价');\n  let products = [];");
rrep('stage-sites', "  const siteList = [...new Set(competitors)].slice(0, 24);", "  stage('同行网站');\n  const siteList = [...new Set(competitors)].slice(0, 24);");
rrep('stage-audit', "  let audit = { items: [], keywords: [], summary: '' };", "  stage('kimi 质检');\n  let audit = { items: [], keywords: [], summary: '' };");

writeFileSync(rp, r, 'utf8');
console.log('radar patched:', rdone.join(', '));

/* ---------- 2) server.mjs: 异步刷新 + 进度 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const sd = [];
const srep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS server.' + n); return; } s = s.replace(a, () => b); sd.push(n); };

const oldRoute = `on('POST', /^\\/api\\/radar\\/refresh$/, async (m, b) => {
  const p = workspace();
  const category = String(b.category || p.category || '').trim();
  if (!category) throw new Error('先填类目（设置页或首次引导）');
  let keywords = [];
  try { keywords = JSON.parse(setting('seed_keywords') || '[]'); } catch {}
  if (Array.isArray(b.keywords) && b.keywords.length) keywords = b.keywords;
  const competitors = Array.isArray(b.competitors) && b.competitors.length ? b.competitors : p.competitors;
  const radar = await buildRadar({
    category,
    keywords: keywords.slice(0, 5),
    competitors,
    market: String(b.market || p.markets || 'us').slice(0, 2).toLowerCase() === 'us' ? 'us' : 'us',
    videosPer: Number(b.videos_per) || 4,
  });`;

const newRoute = `const radarJob = { running: false, stage: '', started_at: '', finished_at: '', error: '', result: null };

on('GET', /^\\/api\\/radar\\/refresh$/, async () => ({
  running: radarJob.running,
  stage: radarJob.stage,
  started_at: radarJob.started_at,
  finished_at: radarJob.finished_at,
  error: radarJob.error,
  counts: radarJob.result
    ? { videos: radarJob.result.videos.length, posts: radarJob.result.posts.length, articles: radarJob.result.articles.length, products: radarJob.result.products.length, keywords: radarJob.result.keywords.length }
    : null,
}));

on('POST', /^\\/api\\/radar\\/refresh$/, async (m, b) => {
  if (radarJob.running) return { started: false, reason: '上一轮还在抓', stage: radarJob.stage };
  const p = workspace();
  const category = String(b.category || p.category || '').trim();
  if (!category) throw new Error('先填类目（设置页或首次引导）');
  let keywords = [];
  try { keywords = JSON.parse(setting('seed_keywords') || '[]'); } catch {}
  if (Array.isArray(b.keywords) && b.keywords.length) keywords = b.keywords;
  const competitors = Array.isArray(b.competitors) && b.competitors.length ? b.competitors : p.competitors;

  radarJob.running = true; radarJob.stage = '准备'; radarJob.started_at = nowIso(); radarJob.finished_at = ''; radarJob.error = ''; radarJob.result = null;

  const job = (async () => {
  const radar = await buildRadar({
    category,
    keywords: keywords.slice(0, 5),
    competitors,
    market: String(b.market || p.markets || 'us').slice(0, 2).toLowerCase() === 'us' ? 'us' : 'us',
    videosPer: Number(b.videos_per) || 4,
    onStage: (st) => { radarJob.stage = st; },
  });`;

srep('route-head', oldRoute, newRoute);

srep('route-tail',
  "  audit('radar.refresh', '', { videos: radar.videos.length, articles: radar.articles.length, sites: radar.competitors.length });\n  return { ok: true, radar };\n});",
  `  audit('radar.refresh', '', { videos: radar.videos.length, articles: radar.articles.length, sites: radar.competitors.length });
  radarJob.result = radar;
  return radar;
  })().catch((e) => { radarJob.error = String(e && e.message || e); }).finally(() => { radarJob.running = false; radarJob.stage = ''; radarJob.finished_at = nowIso(); });

  job.catch(() => {});
  return { started: true, stage: radarJob.stage };
});`);

writeFileSync(sp, s, 'utf8');
console.log('server patched:', sd.join(', '));
