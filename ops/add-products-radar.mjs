import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* 引入浏览器抓取 */
rep('import-browser',
  "import { searchGoogleNews, searchYouTubeYtdlp, searchYouTube, youtubeExtractor, youtubeDateMap } from './sources.mjs';",
  "import { searchGoogleNews, searchYouTubeYtdlp, searchYouTube, youtubeExtractor, youtubeDateMap } from './sources.mjs';\nimport { scrapeProducts, closeBrowser } from './browser.mjs';");

/* 视频质量门槛：优先 2 万播放，其次 5 千，窗口 180 天 */
rep('video-quality',
  `  const recentVideos = allVideos.filter((v) => v.days <= 365);
  const droppedVideos = allVideos.length - recentVideos.length;
  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 20);`,
  `  const within = allVideos.filter((v) => v.days <= 180);
  const views = (v) => Number(v.stats && v.stats.views) || 0;
  const strong = within.filter((v) => views(v) >= 20000);
  const mid = within.filter((v) => views(v) >= 5000);
  const recentVideos = strong.length >= 8 ? strong : (mid.length >= 8 ? mid : within);
  const droppedVideos = allVideos.length - recentVideos.length;
  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 20);`);

/* 帖子质量门槛：互动 >= 20，不足再退到 >= 8 */
rep('post-quality',
  "  const postsHot = uniqByUrl(posts).filter((x) => eng(x) >= (x.platform === 'lemmy' ? 6 : 1)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);",
  `  const postPool = uniqByUrl(posts).filter((x) => (x.days === undefined || x.days <= 365));
  const engHigh = postPool.filter((x) => eng(x) >= 20);
  const engMid = postPool.filter((x) => eng(x) >= 8);
  const postsHot = (engHigh.length >= 10 ? engHigh : (engMid.length >= 10 ? engMid : postPool))
    .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);`);

/* 商品：亚马逊 + 阿里国际站 */
rep('products-scrape',
  "  const sites = await Promise.allSettled(siteList.map((d) => probeCompetitor(d)));",
  `  let products = [];
  try {
    const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
    const scraped = await scrapeProducts(queries);
    products = scraped.items;
    errors.push(...scraped.errors);
  } catch (e) {
    errors.push({ part: 'products', error: e.message });
  } finally {
    closeBrowser().catch(() => {});
  }

  const sites = await Promise.allSettled(siteList.map((d) => probeCompetitor(d)));`);

/* 快照里带上 products */
rep('snapshot-products',
  "      competitors: sites,",
  "      competitors: sites,\n      products: attach(products.slice(0, 24).map((x, i) => ({ ...x, id: 'g' + i })), 'g'),");

/* 换一批：支持 products */
rep('items-products',
  "    articles: uniq(articles).filter((x) => !exclude.has(x.url)).slice(0, 20),",
  `    articles: uniq(articles).filter((x) => !exclude.has(x.url)).slice(0, 20),
    products: await (async () => {
      const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
      const r = await scrapeProducts(queries);
      await closeBrowser().catch(() => {});
      return uniq(r.items).filter((x) => !exclude.has(x.url)).slice(0, 24);
    })(),`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
