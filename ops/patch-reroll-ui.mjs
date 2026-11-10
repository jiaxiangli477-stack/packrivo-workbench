import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 三个列表加「换一批」 */
rep('reroll-videos',
  `<div class="panel-head"><h2>热门视频 · \${counts.videos}</h2><span class="hint">按分数排序 · 已按 kimi 判定过滤 \${r.videos.length - keepItems(r.videos).length} 条</span></div>`,
  `<div class="panel-head"><h2>热门视频 · \${counts.videos}</h2><div class="row tight"><span class="hint">按分数排序 · 已按 kimi 判定过滤 \${r.videos.length - keepItems(r.videos).length} 条</span><button class="btn ghost tiny" data-reroll="videos">换一批</button></div></div>`);

rep('reroll-posts',
  `<div class="panel-head"><h2>帖子 · \${counts.posts}</h2><span class="hint">Mastodon/Lemmy 真实互动 · 已过滤 \${r.posts.length - keepItems(r.posts).length} 条低质/跑题</span></div>`,
  `<div class="panel-head"><h2>帖子 · \${counts.posts}</h2><div class="row tight"><span class="hint">Bluesky / Mastodon / Lemmy · 已过滤 \${r.posts.length - keepItems(r.posts).length} 条</span><button class="btn ghost tiny" data-reroll="posts">换一批</button></div></div>`);

rep('reroll-articles',
  `<div class="panel-head"><h2>文章 / 话题 · \${counts.articles}</h2><span class="hint">Google News · 已过滤 \${r.articles.length - keepItems(r.articles).length} 条</span></div>`,
  `<div class="panel-head"><h2>文章 / 话题 · \${counts.articles}</h2><div class="row tight"><span class="hint">Google News · 已过滤 \${r.articles.length - keepItems(r.articles).length} 条</span><button class="btn ghost tiny" data-reroll="articles">换一批</button></div></div>`);

/* 绑定 */
rep('reroll-bind',
  `  $$('[data-goto]').forEach((b) => (b.onclick = () => { ST.radarTab = b.dataset.goto; viewRadar(); }));`,
  `  $$('[data-goto]').forEach((b) => (b.onclick = () => { ST.radarTab = b.dataset.goto; viewRadar(); }));
  $$('[data-reroll]').forEach((b) => (b.onclick = async () => {
    const scope = b.dataset.reroll;
    b.disabled = true; b.textContent = '换一批…';
    try {
      const r = await api('/api/radar/reroll', 'POST', { scope });
      if (r.fallback) toast('没有更多新的了，保留当前这批；再点「刷新情报」会重新抓');
      else toast('已换 ' + r.count + ' 条新内容');
      viewRadar();
    } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = '换一批'; }
  }));`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
