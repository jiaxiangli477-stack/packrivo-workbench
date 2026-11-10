/* 情报雷达：关键词机会 / 热门视频 / 热门文章 / 同行网站 */
import { searchGoogleNews, searchYouTubeYtdlp, searchYouTube, youtubeExtractor, youtubeDateMap } from './sources.mjs';
import { scrapeProducts, closeBrowser } from './browser.mjs';
import { auditContent, auditKeywords } from './quality.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchText(url, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/* Google 联想词：无 key、无需登录，给长尾关键词 */
export async function suggest(keyword, market = 'us') {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${encodeURIComponent(market)}&q=${encodeURIComponent(keyword)}`;
  const text = await fetchText(url);
  const arr = JSON.parse(text);
  const list = Array.isArray(arr) && Array.isArray(arr[1]) ? arr[1] : [];
  return list.map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
}

/* 同行网站：标题 / 描述 / 建站平台 / 最近文章 */
export async function probeCompetitor(domain) {
  const host = String(domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!host) throw new Error('域名不能为空');
  const base = 'https://' + host;
  const html = await fetchText(base, 20000);
  const pick = (re) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) : '';
  };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).slice(0, 140);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})/i)
    || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,300})/i);
  const platform = /cdn\.shopify\.com|shopify\.theme/i.test(html) ? 'Shopify'
    : /woocommerce|wp-content\/plugins\/woocommerce/i.test(html) ? 'WooCommerce'
    : /wp-content|wordpress/i.test(html) ? 'WordPress'
    : /wixstatic/i.test(html) ? 'Wix'
    : /squarespace/i.test(html) ? 'Squarespace'
    : '未知';

  // 最近文章：优先 RSS，其次 sitemap
  let posts = [];
  const feedLink = (html.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  const candidates = [feedLink, '/feed', '/blog/feed', '/rss.xml', '/blog/rss.xml'].filter(Boolean);
  for (const c of candidates.slice(0, 3)) {
    try {
      const u = c.startsWith('http') ? c : base + c;
      const xml = await fetchText(u, 12000);
      const titles = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]{3,200}?)(?:\]\]>)?<\/title>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      if (titles.length) {
        posts = titles.map((t) => decodeEntities(t)).slice(0, 5);
        break;
      }
    } catch {}
  }

  return {
    domain: host,
    url: base,
    title,
    description: desc,
    platform,
    posts,
    checked_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

/* 一次抓取全量情报 */
export async function buildRadar({ category, keywords = [], competitors = [], market = 'us', videosPer = 4, onStage = null }) {
  const stage = (s) => { try { onStage && onStage(s); } catch {} };
  // 类目整串（"jewelry, candle & gift packaging"）直接丢给 YouTube 只会搜到娱乐视频，
  // 拆成 token 再补 packaging/box，命中率才正常
  const tokens = String(category || '').split(/[,&/|]+/).map((s) => s.trim()).filter((s) => s.length > 2);
  const derived = tokens.flatMap((t) => [t + ' packaging box', t + ' packaging']);
  const seeds = [...new Set([...keywords, ...derived].filter(Boolean))].slice(0, 6);
  const errors = [];

  stage('关键词联想');
  const kwGroups = await Promise.all(seeds.map(async (seed) => {
    try {
      return { seed, suggestions: await suggest(seed, market) };
    } catch (e) {
      errors.push({ part: 'suggest', seed, error: e.message });
      return { seed, suggestions: [] };
    }
  }));

  stage('热门视频');
  const videos = [];
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
  videos.push(...videoBatches.flat());

  stage('热门文章');
  const articles = [];
  const newsBatches = await Promise.all(seeds.slice(0, 6).map(async (seed) => {
    try {
      return await searchGoogleNews(`${seed} packaging`, 8);
    } catch (e) {
      errors.push({ part: 'news', seed, error: e.message });
      return [];
    }
  }));
  articles.push(...newsBatches.flat());

  stage('社区帖子');
  const posts = [];
  const tags = [...new Set(['jewelrybox', 'jewelrypackaging', 'candlepackaging', 'candlebox', 'candlemaking', 'giftbox', 'giftwrapping', 'packaging', 'unboxing', 'smallbusiness', 'jewelrydesign', 'handmadebusiness'])].slice(0, 12);
  for (const tag of tags) {
    try { posts.push(...(await searchMastodon(tag, 20))); } catch (e) { errors.push({ part: 'mastodon', seed: tag, error: e.message }); }
  }
  // 硬相关性：论坛搜索很模糊，必须命中行业词才收（mailer 会被政治新闻误命中，所以用 packag/carton/kraft 等）
  const INDUSTRY = /\b(packaging|carton|corrugated|kraft|rigid box|mailer box|shipping box|paper box|packaging design)\b/i;
  const NOISE = /package manager|linux distro|npm install|apt-get|steam deck|gaming news/i;
  const topicWords = [...new Set(seeds.flatMap((s) => String(s).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 5)))];
  {
    const queries = ['jewelry box packaging', 'jewelry packaging', 'candle packaging', 'gift box packaging', 'unboxing jewelry', 'packaging design', 'custom packaging'];
    for (const q of queries) {
      try { posts.push(...(await searchBluesky(q, 12))); } catch (e) { errors.push({ part: 'bluesky', seed: q, error: e.message }); }
    }
  }
  for (const seed of seeds.slice(0, 2)) {
    try {
      const got = await searchLemmy(seed, 12);
      const keep = got.filter((x) => { const h = x.title + ' ' + x.snippet; return INDUSTRY.test(h) && !NOISE.test(h); });
      posts.push(...keep.slice(0, 4));
    } catch (e) { errors.push({ part: 'lemmy', seed, error: e.message }); }
  }
  // Mastodon 同样按话题词过滤，去掉跑题的个人动态
  const mastro = posts.filter((x) => x.platform !== 'mastodon');
  const mastoOnly = posts.filter((x) => x.platform === 'mastodon');
  const mastoKeep = mastoOnly.filter((x) => {
    const hay = x.title + ' ' + x.snippet;
    return INDUSTRY.test(hay) && !NOISE.test(hay);
  });
  posts.length = 0;
  posts.push(...mastro, ...mastoKeep);
  stage('商品比价');
  let products = [];
  try {
    const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
    const scraped = await Promise.race([
      scrapeProducts(queries),
      new Promise((_, rej) => setTimeout(() => rej(new Error('商品抓取超时（120s）')), 120000)),
    ]);
    products = scraped.items || [];
    errors.push(...(scraped.errors || []));
  } catch (e) {
    errors.push({ part: 'products', error: e.message });
  }

  stage('同行网站');
  const siteList = [...new Set(competitors)].slice(0, 24);
  const siteResults = await Promise.allSettled(siteList.map((d) => probeCompetitor(d)));
  const sites = [];
  siteResults.forEach((r, i) => {
    if (r.status === 'fulfilled') sites.push(r.value);
    else errors.push({ part: 'competitor', domain: siteList[i], error: String(r.reason && r.reason.message || r.reason || 'failed') });
  });

  const uniqByUrl = (arr) => {
    const seen = new Set();
    return arr.filter((x) => (x.url && !seen.has(x.url) ? (seen.add(x.url), true) : false));
  };

  // 互动门槛：没热度的帖子直接不要（Mastodon 赞+转+回复 < 3，Lemmy 顶+评论 < 10）
  const eng = (x) => x.platform === 'lemmy'
    ? (x.stats.score || 0) + (x.stats.comments || 0)
    : (x.stats.fav || 0) + (x.stats.boost || 0) + (x.stats.reply || 0);
  const postPool = uniqByUrl(posts).filter((x) => (x.days === undefined || x.days <= 365));
  const engHigh = postPool.filter((x) => eng(x) >= 20);
  const engMid = postPool.filter((x) => eng(x) >= 8);
  const postsHot = (engHigh.length >= 10 ? engHigh : (engMid.length >= 10 ? engMid : postPool))
    .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);
  const DIY = /\b(diy|handmade|hand-made|craft|at home)\b/i;
  const rankScore = (v) => {
    let s = Number(v.score) || 0;
    if (DIY.test(v.title || '')) s -= 12;          // DIY 手工类降权
    if (v.days > 365) s -= 40;                      // 超过 12 个月大幅降权
    return s;
  };
  // 泛词搜索会把 storage unit 寻宝、squishy 盲盒这类娱乐视频带进来，先按行业词过滤再交给质检
  const VIDEO_RELEVANT = /packaging|package|packaging design|carton|corrugated|kraft|paper box|rigid box|printed box|mailer|insert|foam|box manufactur/i;
  const VIDEO_NOISE = /lyrics|visualizer|official (music )?video|gameplay|unboxing (haul|prank)|squishy|storage unit/i;
  const relevantVideos = videos.filter((v) => {
    const hay = (v.title || '') + ' ' + (v.snippet || '');
    return VIDEO_RELEVANT.test(hay) && !VIDEO_NOISE.test(hay);
  });
  const allVideos = uniqByUrl(relevantVideos.length >= 6 ? relevantVideos : videos);
  const within = allVideos.filter((v) => v.days <= 180);
  const views = (v) => Number(v.stats && v.stats.views) || 0;
  const strong = within.filter((v) => views(v) >= 20000);
  const mid = within.filter((v) => views(v) >= 5000);
  const low = within.filter((v) => views(v) >= 2000);
  const recentVideos = strong.length >= 12 ? strong
    : (mid.length >= 12 ? mid
    : (low.length >= 12 ? low : within.filter((v) => views(v) >= 1000)));
  const droppedVideos = allVideos.length - recentVideos.length;
  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 20);
  const articlesTop = uniqByUrl(articles).slice(0, 20);

  // kimi 质检（条目 + 关键词并行）
  stage('kimi 质检');
  let audit = { items: [], keywords: [], summary: '' };
  try {
    // 顺序执行 + 失败重试：两个审查并发时偶发空结果
    let ca = await auditContent({ category, videos: videosTop, posts: postsHot, articles: articlesTop });
    if (!ca.items || !ca.items.length) ca = await auditContent({ category, videos: videosTop, posts: postsHot, articles: articlesTop });
    let ka = await auditKeywords({ category, groups: kwGroups });
    if (!ka.items || !ka.items.length) ka = await auditKeywords({ category, groups: kwGroups });
    audit = { items: ca.items || [], keywords: ka.items || [], summary: ca.summary || '', via: ca.via || '', at: new Date().toISOString().replace('T', ' ').slice(0, 19) };

    // kimi 可能把整批都判 drop（搜索词太泛时常见）。此时保留分数最高的几条并标注"低相关保留"，
    // 否则页面只剩一个空状态，用户无法判断是没抓到还是被过滤了
    const allDrop = audit.items.length > 0 && audit.items.every((x) => x.verdict !== 'keep');
    if (allDrop) {
      const ranked = [...audit.items].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
      ranked.slice(0, 6).forEach((x, i) => {
        if (i < 6 && (Number(x.score) || 0) >= 8) {
          x.verdict = 'keep';
          x.reason = '低相关保留（' + (x.reason || '').slice(0, 60) + '）';
        }
      });
      audit.summary = (audit.summary || '') + '｜全部判 drop，已保留分数最高 8 条供参考';
    }
    const scoreMap = new Map(audit.items.map((x) => [x.id, x]));
    const attach = (arr, prefix) => arr.map((x, i) => {
      const a = scoreMap.get(prefix + i);
      return a ? { ...x, ai: { score: a.score, verdict: a.verdict, reason: a.reason } } : x;
    });
    const kwsMap = new Map(audit.keywords.map((x) => [x.id, x]));
    const kwGroups2 = kwGroups.map((g, gi) => ({
      ...g,
      suggestions: g.suggestions.map((kw, ki) => {
        const a = kwsMap.get(`k${gi}_${ki}`);
        return { word: kw, position: ki + 1, ai: a ? { score: a.score, verdict: a.verdict, reason: a.reason } : null };
      }),
    }));
    return {
      generated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      category,
      market,
      seeds,
      keywords: kwGroups2,
      videos: attach(videosTop, 'v'),
      posts: attach(postsHot, 'p'),
      articles: attach(articlesTop, 'a'),
      competitors: sites,
      products: attach(products.slice(0, 24).map((x, i) => ({ ...x, id: 'g' + i })), 'g'),
      video_filter: { kept: videosTop.length, dropped_older_or_unknown: droppedVideos, window_days: 365 },
      audit,
      errors,
    };
  } catch (e) {
    errors.push({ part: 'audit', error: e.message });
  }

  return {
    generated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    category,
    market,
    seeds,
    keywords: kwGroups.map((g) => ({ ...g, suggestions: g.suggestions.map((kw, i) => ({ word: kw, position: i + 1, ai: null })) })),
    videos: videosTop,
    posts: postsHot,
    articles: articlesTop,
    competitors: sites,
    audit,
    errors,
  };
}

/* ============ 社媒帖子源（开放 API，无需 Key） ============ */

function stripHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : '');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', copy: '©', reg: '®', trade: '™' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
}
const INDUSTRY_RE = /\b(packaging|carton|corrugated|kraft|rigid box|mailer box|shipping box|paper box|packaging design|jewelry box|candle|gift box|unboxing|jewelry packaging|pouch)\b/i;
const NOISE_RE = /package manager|linux distro|npm install|apt-get|steam deck|gaming news|hot wheels|magic: the gathering|mtg/i;
const industryOk = (s) => INDUSTRY_RE.test(s || '') && !NOISE_RE.test(s || '');

/* Mastodon：公开标签时间线，带媒体缩略图与互动数 */
export async function searchMastodon(tag, limit = 6) {
  const url = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag.replace(/\s+/g, ''))}?limit=${Math.min(20, limit * 2)}`;
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
  if (!res.ok) throw new Error('Mastodon HTTP ' + res.status);
  const arr = await res.json();
  return arr.slice(0, limit).map((s) => {
    const fav = Number(s.favourites_count) || 0;
    const boost = Number(s.reblogs_count) || 0;
    const reply = Number(s.replies_count) || 0;
    const media = (s.media_attachments || [])[0];
    const created = s.created_at || '';
    return {
      source: 'mastodon',
      platform: 'mastodon',
      kind: 'post',
      title: stripHtml(s.content).slice(0, 180) || '(无正文)',
      url: s.url || s.uri || '',
      author: s.account?.acct || '',
      published: fmtDay(created),
      days: created ? Math.max(0, Math.round((Date.now() - Date.parse(created)) / 86400000)) : 999,
      stats: { fav, boost, reply, lang: s.language || '' },
      thumb: media?.preview_url || media?.url || s.account?.avatar || '',
      snippet: stripHtml(s.content).slice(0, 300),
      score: Math.min(100, Math.round(30 + 15 * Math.log10(fav + boost + reply + 1))),
      score_type: 'measured',
    };
  });
}

/* Lemmy：开放论坛，按热度搜帖子，带分数与评论数 */
export async function searchLemmy(query, limit = 6) {
  const url = `https://lemmy.world/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&sort=TopAll&limit=${Math.min(20, limit)}`;
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
  if (!res.ok) throw new Error('Lemmy HTTP ' + res.status);
  const data = await res.json();
  return (data.posts || []).slice(0, limit).map((row) => {
    const p = row.post || {};
    const counts = row.counts || {};
    const score = Number(counts.score) || 0;
    const comments = Number(counts.comments) || 0;
    const created = p.published || '';
    return {
      source: 'lemmy',
      platform: 'lemmy',
      kind: 'post',
      title: p.name || '',
      url: p.id ? `https://lemmy.world/post/${p.id}` : (p.url || ''),
      author: row.creator?.name || '',
      published: fmtDay(created),
      days: created ? Math.max(0, Math.round((Date.now() - Date.parse(created)) / 86400000)) : 999,
      stats: { score, comments, community: row.community?.name || '' },
      thumb: p.thumbnail_url || '',
      snippet: String(p.body || p.url || '').slice(0, 300),
      score: Math.min(100, Math.round(30 + 18 * Math.log10(score + comments + 1))),
      score_type: 'measured',
    };
  });
}

/* Bluesky：公开搜索接口（api.bsky.app），带赞/转/回复与配图 */
export async function searchBluesky(query, limit = 6) {
  const url = `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(25, limit * 2)}&sort=top`;
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
  if (!res.ok) throw new Error('Bluesky HTTP ' + res.status);
  const data = await res.json();
  return (data.posts || []).slice(0, limit).map((p) => {
    const rec = p.record || {};
    const imgs = p.embed?.images || p.embed?.media?.images || [];
    const img = imgs[0];
    const handle = p.author?.handle || '';
    const rkey = String(p.uri || '').split('/').pop();
    const created = p.indexedAt || rec.createdAt || '';
    const likes = Number(p.likeCount) || 0;
    const reposts = Number(p.repostCount) || 0;
    const replies = Number(p.replyCount) || 0;
    return {
      source: 'bluesky',
      platform: 'bluesky',
      kind: 'post',
      title: String(rec.text || '').slice(0, 180) || '(无正文)',
      url: handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : '',
      author: handle,
      published: created ? String(created).slice(0, 10) : '',
      days: created ? Math.max(0, Math.round((Date.now() - Date.parse(created)) / 86400000)) : 999,
      stats: { fav: likes, boost: reposts, reply: replies },
      thumb: img ? (img.thumb || img.fullsize || '') : '',
      snippet: String(rec.text || '').slice(0, 300),
      score: Math.min(100, Math.round(28 + 16 * Math.log10(likes + reposts + replies + 1))),
      score_type: 'measured',
    };
  });
}

/* 只抓条目（不含质检/竞品），用于「换一批」：快，且跳过已看过的 URL */
export async function buildItems({ category, seeds = [], exclude = new Set(), per = 6 }) {
  const errors = [];
  const uniq = (arr) => {
    const seen = new Set();
    return arr.filter((x) => (x && x.url && !seen.has(x.url) ? (seen.add(x.url), true) : false));
  };

  const videos = [];
  for (const seed of seeds.slice(0, 3)) {
    try {
      const items = await searchYouTubeYtdlp(seed, per * 2);
      const dates = await youtubeDateMap(seed, per * 2);
      videos.push(...items.map((it) => {
        const id = (it.url.match(/v=([\w-]+)/) || [])[1];
        const d = id ? dates.get(id) : null;
        return d ? { ...it, published: d.published, days: d.days } : it;
      }));
    } catch (e) { errors.push({ part: 'youtube', seed, error: e.message }); }
  }

  const posts = [];
  for (const seed of seeds.slice(0, 2)) {
    try { posts.push(...(await searchBluesky(`${seed} packaging`, per))); } catch (e) { errors.push({ part: 'bluesky', seed, error: e.message }); }
  }
  const tags = [...new Set([String(category).replace(/\s+/g, ''), 'packaging'])].slice(0, 2);
  for (const tag of tags) {
    try { posts.push(...(await searchMastodon(tag, per * 2))); } catch (e) { errors.push({ part: 'mastodon', seed: tag, error: e.message }); }
  }

  const articles = [];
  for (const seed of seeds.slice(0, 3)) {
    try { articles.push(...(await searchGoogleNews(`${seed} packaging`, per))); } catch (e) { errors.push({ part: 'news', seed, error: e.message }); }
  }

  return {
    videos: (() => {
      const DIYRE = /\b(diy|handmade|hand-made|craft|at home)\b/i;
      const rank = (v) => (Number(v.score) || 0) - (DIYRE.test(v.title || '') ? 12 : 0) - (v.days > 365 ? 40 : 0);
      const pool = uniq(videos).filter((x) => !exclude.has(x.url)).filter((v) => v.days <= 180);
      const vw = (v) => Number(v.stats && v.stats.views) || 0;
      const pass = pool.filter((v) => vw(v) >= 5000);
      const use = pass.length >= 12 ? pass : pool.filter((v) => vw(v) >= 2000);
      return (use.length ? use : pool).sort((a, b) => rank(b) - rank(a)).slice(0, 20);
    })(),
    posts: uniq(posts)
      .filter((x) => !exclude.has(x.url))
      .filter((x) => industryOk((x.title || '') + ' ' + (x.snippet || '')))
      .filter((x) => {
        const e = x.platform === 'lemmy'
          ? (x.stats.score || 0) + (x.stats.comments || 0)
          : (x.stats.fav || 0) + (x.stats.boost || 0) + (x.stats.reply || 0);
        return e >= (x.platform === 'lemmy' ? 10 : 3);
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),
    articles: uniq(articles).filter((x) => !exclude.has(x.url)).slice(0, 20),
    products: await (async () => {
      const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
      const r = await scrapeProducts(queries);
      await closeBrowser().catch(() => {});
      return uniq(r.items).filter((x) => !exclude.has(x.url)).slice(0, 24);
    })(),
    errors,
  };
}