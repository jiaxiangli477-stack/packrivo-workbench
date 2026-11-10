/* 关键词找爆款：YouTube（yt-dlp 真实播放量，HTML 兜底）+ Google News / Bing News（文章）+ Apify（待配置） */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const TOOLS = path.resolve(import.meta.dirname, '..', 'tools');
const YTDLP = path.join(TOOLS, 'yt-dlp.exe');
const TMPDIR = path.join(TOOLS, 'tmp');
try { mkdirSync(TMPDIR, { recursive: true }); } catch {}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function youtubeExtractor() {
  return existsSync(YTDLP) ? 'yt-dlp' : 'html';
}

/* yt-dlp 搜索：拿得到精确播放量、上传日期、时长、字幕/简介摘要（拿不到点赞评论，完整抽取需 cookies） */
export async function searchYouTubeYtdlp(keyword, limit = 6) {
  const args = ['--flat-playlist', '--dump-json', '--no-warnings', '--skip-download', `ytsearch${limit}:${keyword}`];
  const { stdout } = await execFileAsync(YTDLP, args, {
    env: { ...process.env, TMP: TMPDIR, TEMP: TMPDIR },
    timeout: 120000,
    maxBuffer: 48 * 1024 * 1024,
    windowsHide: true,
  });
  const out = [];
  for (const line of String(stdout).split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let j;
    try { j = JSON.parse(s); } catch { continue; }
    if (!j.id) continue;
    const views = Number(j.view_count) || 0;
    const ts = Number(j.timestamp) || 0;
    const days = ts ? Math.max(0, Math.round((Date.now() / 1000 - ts) / 86400)) : 999;
    out.push({
      source: 'youtube',
      platform: 'youtube',
      kind: 'video',
      title: j.title || '',
      url: `https://www.youtube.com/watch?v=${j.id}`,
      thumb: `https://i.ytimg.com/vi/${j.id}/mqdefault.jpg`,
      author: j.channel || j.uploader || '',
      published: ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '',
      days,
      stats: { views, duration: Number(j.duration) || 0 },
      snippet: String(j.description || '').slice(0, 300),
      score: Math.min(100, Math.round(20 + 12 * Math.log10(Math.max(views, 1)))),
      score_type: 'measured',
    });
  }
  return out.slice(0, limit);
}

async function get(url, timeoutMs = 20000) {
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

function parseCount(text) {
  const s = String(text || '').toLowerCase().replace(/,/g, '');
  const m = s.match(/([\d.]+)\s*([kmb])?/);
  if (!m) return 0;
  const n = Number(m[1]) || 0;
  const mul = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
  return Math.round(n * mul);
}

function relDays(text) {
  const s = String(text || '').toLowerCase();
  const m = s.match(/(\d+)\s*(second|sec|minute|min|hour|week|month|year|mo|yr|s|h|d|w|y|m)/);
  if (!m) return 999;
  const n = Number(m[1]);
  const u = m[2];
  let days;
  if (u.startsWith('sec') || u === 's') days = n / 86400;
  else if (u.startsWith('min') || u === 'h' && false) days = n / 1440;
  else if (u === 'h' || u.startsWith('hour')) days = n / 24;
  else if (u === 'd' || u.startsWith('day')) days = n;
  else if (u === 'w' || u.startsWith('week')) days = n * 7;
  else if (u === 'mo' || u.startsWith('month') || u === 'm') days = n * 30;
  else days = n * 365;
  return Math.max(0, Math.round(days));
}

/* 视频：真实播放量 */
export async function searchYouTube(keyword, limit = 20) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=EgQIBRAB`);
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  const data = JSON.parse(m[1]);
  const out = [];
  const seen = new Set();
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 12 || out.length >= limit) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const v = node.videoRenderer;
    if (v && v.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      const viewsText = v.viewCountText?.simpleText || v.viewCountText?.runs?.map((r) => r.text).join('') || '';
      const views = parseCount(viewsText);
      const published = v.publishedTimeText?.simpleText || '';
      out.push({
        source: 'youtube',
        platform: 'youtube',
        kind: 'video',
        title: (v.title?.runs || []).map((r) => r.text).join('') || '',
        url: 'https://www.youtube.com/watch?v=' + v.videoId,
      thumb: 'https://i.ytimg.com/vi/' + v.videoId + '/mqdefault.jpg',
        author: (v.ownerText?.runs || [])[0]?.text || '',
        published,
        days: relDays(published),
        stats: { views, views_text: viewsText },
        snippet: ((v.detailedMetadataSnippets || [])[0]?.snippetText?.runs || []).map((r) => r.text).join('').slice(0, 300),
        score: Math.min(100, Math.round(20 + 12 * Math.log10(Math.max(views, 1)))),
        score_type: 'measured',
      });
    }
    Object.values(node).forEach((n) => walk(n, depth + 1));
  };
  walk(data);
  return out;
}

/* yt-dlp 的搜索模式不带上传时间，这里用一次 HTML 搜索补齐日期 */
export async function youtubeDateMap(keyword, limit = 6) {
  const map = new Map();
  try {
    const items = await searchYouTube(keyword, limit);
    for (const it of items) {
      const id = (it.url.match(/v=([\w-]+)/) || [])[1];
      if (id && it.published) map.set(id, { published: it.published, days: it.days });
    }
  } catch {}
  return map;
}
/* 文章：Google News RSS（标题/来源/时间，无互动数据，分数为估算） */
export async function searchGoogleNews(keyword, limit = 6) {
  const xml = await get(`https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en`);
  return parseRss(xml, 'gnews', keyword, limit);
}

export async function searchBingNews(keyword, limit = 6) {
  const xml = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=RSS`);
  return parseRss(xml, 'bingnews', keyword, limit);
}

function parseRss(xml, source, keyword, limit) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const pick = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(block);
      return r ? r[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const title = pick('title');
    const link = pick('link');
    if (!title || !link) continue;
    const pub = pick('pubDate');
    const src = pick('source') || new URL(link).hostname.replace(/^www\./, '');
    const days = pub ? Math.max(0, Math.round((Date.now() - Date.parse(pub)) / 86400000)) : 999;
    const relevance = String(title).toLowerCase().includes(String(keyword).toLowerCase()) ? 15 : 0;
    const recency = days <= 7 ? 20 : days <= 30 ? 10 : 0;
    items.push({
      source,
      platform: 'article',
      kind: 'article',
      title,
      url: link,
      author: src,
      thumb: 'https://www.google.com/s2/favicons?domain=' + new URL(link).hostname + '&sz=64',
      published: pub ? pub.slice(0, 16) : '',
      days,
      stats: { outlet: src },
      score: Math.min(100, Math.round(45 + relevance + recency)),
      score_type: 'estimated',
      keyword,
    });
  }
  return items;
}

/* Apify：接上 Token 后可跑 TikTok / IG / FB，返回真实互动数据 */
export async function searchApify(keyword, { token, actor, limit = 6 }) {
  if (!token || !actor) {
    const e = new Error('Apify 未配置（需要 Token 与 Actor ID）');
    e.code = 'pending_config';
    throw e;
  }
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ search: keyword, keywords: [keyword], maxItems: limit }),
  });
  if (!r.ok) throw new Error('Apify HTTP ' + r.status);
  const items = await r.json();
  return (Array.isArray(items) ? items : []).slice(0, limit).map((it) => {
    const plays = Number(it.playCount || it.videoViewCount || it.views || 0);
    const likes = Number(it.diggCount || it.likes || 0);
    const comments = Number(it.commentCount || it.comments || 0);
    return {
      source: 'apify',
      platform: it.platform || 'tiktok',
      kind: 'video',
      title: String(it.text || it.caption || it.title || '').slice(0, 300),
      url: it.url || it.postPageUrl || it.webVideoUrl || '',
      author: it.authorMeta?.name || it.ownerUsername || it.pageName || '',
      published: it.createTimeISO || '',
      days: it.createTimeISO ? Math.max(0, Math.round((Date.now() - Date.parse(it.createTimeISO)) / 86400000)) : 999,
      stats: { views: plays, likes, comments },
      score: Math.min(100, Math.round(15 + 10 * Math.log10(Math.max(plays, 1)) + 5 * Math.log10(Math.max(likes, 1)))),
      score_type: 'measured',
      keyword,
    };
  });
}

export const SOURCES = {
  youtube: { label: 'YouTube 视频', kind: 'video', state: 'ready', note: 'yt-dlp 精确播放量+上传日期，无需 Key' },
  gnews: { label: 'Google News 文章', kind: 'article', state: 'ready', note: '真实标题与来源，无互动数据（分数为估算）' },
  bingnews: { label: 'Bing News 文章', kind: 'article', state: 'ready', note: '备用新闻源，无互动数据' },
  apify: { label: 'Apify（TikTok/IG/FB）', kind: 'video', state: 'pending_config', note: '需要 Apify Token + Actor ID，才有真实互动数据' },
};

export async function discover({ keywords, sources, per = 5, minScore = 0, apify = {} }) {
  const items = [];
  const errors = [];
  for (const kw of keywords) {
    for (const s of sources) {
      try {
        let got = [];
        if (s === 'youtube') {
          if (youtubeExtractor() === 'yt-dlp') {
            got = await searchYouTubeYtdlp(kw, per);
            const dates = await youtubeDateMap(kw, per);
            got = got.map((it) => {
              const id = (it.url.match(/v=([\w-]+)/) || [])[1];
              const d = id ? dates.get(id) : null;
              return d ? { ...it, published: d.published, days: d.days } : it;
            });
          } else {
            got = await searchYouTube(kw, per);
          }
        }
        else if (s === 'gnews') got = await searchGoogleNews(kw, per);
        else if (s === 'bingnews') got = await searchBingNews(kw, per);
        else if (s === 'apify') got = await searchApify(kw, { ...apify, limit: per });
        items.push(...got.map((x) => ({ ...x, keyword: kw })));
      } catch (e) {
        errors.push({ keyword: kw, source: s, error: e.message, code: e.code || '' });
      }
    }
  }
  const seen = new Set();
  return {
    items: items
      .filter((x) => {
        if (seen.has(x.url)) return false;
        seen.add(x.url);
        return (x.score || 0) >= minScore;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
    errors,
  };
}
