import { searchYouTube, searchYouTubeYtdlp, searchGoogleNews } from '../app/sources.mjs';

const q = 'custom packaging box';
try {
  const items = await searchYouTube(q, 8);
  console.log('searchYouTube 条数:', items.length);
  items.slice(0, 8).forEach((x, i) => console.log(`${i}. [${x.stats?.views_text || '?'}] ${x.title.slice(0, 80)}`));
} catch (e) {
  console.log('searchYouTube 失败:', e.message.slice(0, 200));
}

try {
  const viaYtdlp = await searchYouTubeYtdlp(q, 5);
  console.log('yt-dlp 条数:', viaYtdlp.length);
  viaYtdlp.slice(0, 5).forEach((x, i) => console.log(`Y${i}. ${x.title.slice(0, 80)}`));
} catch (e) {
  console.log('yt-dlp 失败:', e.message.slice(0, 160));
}
