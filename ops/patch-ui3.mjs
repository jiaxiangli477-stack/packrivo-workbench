import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 空态给出「被谁判掉、为什么」，而不是一句没抓到 */
rep('post-empty',
  `<div class="media-grid">\${keepItems(r.posts).map(cardPost).join('') || '<div class="empty">没抓到帖子</div>'}</div>`,
  `<div class="media-grid">\${keepItems(r.posts).map(cardPost).join('') || \`<div class="empty" style="grid-column:1/-1">
        <div style="margin-bottom:8px">Mastodon / Lemmy 这次没有通过质检的帖子</div>
        \${r.posts.length ? \`<div style="text-align:left;margin-top:8px">
          <div class="nav-label" style="padding-left:0">kimi 判丢弃的 \${r.posts.length} 条及理由</div>
          \${r.posts.map((x) => \`<div class="muted" style="font-size:11.5px;padding:2px 0">· \${esc((x.title || '').slice(0, 60))} — \${esc(x.ai?.reason || '无理由')}</div>\`).join('')}
        </div>\` : '<div class="muted" style="margin-top:6px">这次一条帖子都没抓到</div>'}
      </div>\`}</div>`);

/* 视频同样处理 */
rep('video-empty',
  `<div class="media-grid">\${keepItems(r.videos).map(cardVideo).join('') || '<div class="empty">没抓到视频，点右上「刷新情报」</div>'}</div>`,
  `<div class="media-grid">\${keepItems(r.videos).map(cardVideo).join('') || \`<div class="empty" style="grid-column:1/-1">
      <div>没有通过质检的视频</div>
      \${r.videos.length ? \`<div style="text-align:left;margin-top:8px">\${r.videos.map((x) => \`<div class="muted" style="font-size:11.5px">· \${esc((x.title || '').slice(0, 56))} — \${esc(x.ai?.reason || '')}</div>\`).join('')}</div>\` : ''}
    </div>\`}</div>`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
