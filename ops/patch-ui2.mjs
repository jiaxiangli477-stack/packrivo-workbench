import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 过滤 AI 判丢弃的条目，并保留原始下标 */
rep('keep-helper',
  `function thumbUrl(u) {`,
  `function keepItems(arr) {
  return (arr || []).filter((x) => !x.ai || x.ai.verdict !== 'drop');
}

function thumbUrl(u) {`);

rep('video-index', `data-save-video="\${i}"`, `data-save-video="\${r.videos.indexOf(v)}"`);
rep('post-index', `data-save-post="\${i}"`, `data-save-post="\${r.posts.indexOf(p)}"`);
rep('article-index', `data-save-article="\${i}"`, `data-save-article="\${r.articles.indexOf(a)}"`);

/* 概览与子版块都用过滤后的列表 */
rep('overview-videos', `\${r.videos.slice(0, 3).map(cardVideo)`, `\${keepItems(r.videos).slice(0, 3).map(cardVideo)`);
rep('overview-posts', `\${r.posts.slice(0, 4).map((p) =>`, `\${keepItems(r.posts).slice(0, 4).map((p) =>`);
rep('tab-videos', `\${r.videos.map(cardVideo)`, `\${keepItems(r.videos).map(cardVideo)`);
rep('tab-posts', `\${r.posts.map(cardPost)`, `\${keepItems(r.posts).map(cardPost)`);
rep('tab-articles', `\${r.articles.map((a, i) =>`, `\${keepItems(r.articles).map((a) =>`);

/* 面板标题带上「已过滤」计数 */
rep('video-hint',
  `<span class="hint">按分数排序，可一键入库</span>`,
  `<span class="hint">按分数排序 · 已按 kimi 判定过滤 \${r.videos.length - keepItems(r.videos).length} 条</span>`);
rep('post-hint',
  `<span class="hint">Mastodon 标签时间线 + Lemmy 论坛，都带真实互动数</span>`,
  `<span class="hint">Mastodon/Lemmy 真实互动 · 已过滤 \${r.posts.length - keepItems(r.posts).length} 条低质/跑题</span>`);
rep('article-hint',
  `<span class="hint">Google News，无互动数据</span>`,
  `<span class="hint">Google News · 已过滤 \${r.articles.length - keepItems(r.articles).length} 条</span>`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
