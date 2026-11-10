import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 视频：改用 HTML 搜索（带发布时间），每个词多取，目标 20 条 */
rep('video-html',
  `  const videos = [];
  for (const seed of seeds.slice(0, 3)) {
    try {
      const items = youtubeExtractor() === 'yt-dlp' ? await searchYouTubeYtdlp(seed, videosPer) : await searchYouTube(seed, videosPer);
      if (youtubeExtractor() === 'yt-dlp') {
        const dates = await youtubeDateMap(seed, videosPer);
        videos.push(...items.map((it) => {
          const id = (it.url.match(/v=([\\w-]+)/) || [])[1];
          const d = id ? dates.get(id) : null;
          return d ? { ...it, published: d.published, days: d.days } : it;
        }));
      } else {
        videos.push(...items);
      }
    } catch (e) {
      errors.push({ part: 'youtube', seed, error: e.message });
    }
  }`,
  `  const videos = [];
  for (const seed of seeds.slice(0, 4)) {
    try {
      // HTML 搜索能拿到 "3 weeks ago" 这类发布时间，覆盖比 yt-dlp 高
      let items = [];
      try { items = await searchYouTube(seed, 12); } catch {}
      if (!items.length) items = await searchYouTubeYtdlp(seed, 10);
      videos.push(...items);
    } catch (e) {
      errors.push({ part: 'youtube', seed, error: e.message });
    }
  }`);

/* 视频窗口过滤后取 20 条 */
rep('video-top20',
  `  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 12);`,
  `  const videosTop = recentVideos.sort((a, b) => rankScore(b) - rankScore(a)).slice(0, 20);`);

/* 文章：20 条 */
rep('articles-20',
  `    articles: uniqByUrl(articles).slice(0, 18),`,
  `    articles: uniqByUrl(articles).slice(0, 20),`);
rep('articles-per',
  "      const res = await searchGoogleNews(`${seed} packaging`, 5);",
  "      const res = await searchGoogleNews(`${seed} packaging`, 8);");

/* 帖子：加大各个源，过滤后取 20 */
rep('posts-bluesky',
  "    try { posts.push(...(await searchBluesky(`${seed} packaging`, 5))); } catch (e) { errors.push({ part: 'bluesky', seed, error: e.message }); }",
  "    try { posts.push(...(await searchBluesky(`${seed} packaging`, 12))); } catch (e) { errors.push({ part: 'bluesky', seed, error: e.message }); }");
rep('posts-mastodon',
  "    try { posts.push(...(await searchMastodon(tag, 8))); } catch (e) { errors.push({ part: 'mastodon', seed: tag, error: e.message }); }",
  "    try { posts.push(...(await searchMastodon(tag, 20))); } catch (e) { errors.push({ part: 'mastodon', seed: tag, error: e.message }); }");
rep('posts-tags',
  "  const tags = [...new Set([String(category).replace(/\\s+/g, ''), 'packaging', 'mailerbox', 'kraftpaper', 'sustainablepackaging'])].slice(0, 4);",
  "  const tags = [...new Set(['jewelrybox', 'candlepackaging', 'giftbox', 'packaging', 'jewelrypackaging'])].slice(0, 5);");
rep('posts-top20',
  "  const postsHot = uniqByUrl(posts).filter((x) => eng(x) >= (x.platform === 'lemmy' ? 10 : 3)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12);",
  "  const postsHot = uniqByUrl(posts).filter((x) => eng(x) >= (x.platform === 'lemmy' ? 10 : 3)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);");

/* 换一批同样 20 条 */
rep('items-videos-20',
  "      return pool.filter((v) => v.days <= 365).sort((a, b) => rank(b) - rank(a)).slice(0, 12);",
  "      return pool.filter((v) => v.days <= 365).sort((a, b) => rank(b) - rank(a)).slice(0, 20);");
rep('items-posts-20',
  "      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),",
  "      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),");

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
