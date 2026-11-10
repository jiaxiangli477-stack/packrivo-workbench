import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(p, 'utf8');
const done = [];
const rep = (n, x, y) => { if (!a.includes(x)) { console.log('MISS', n); return; } a = a.replace(x, y); done.push(n); };

/* 1) 标签页加「商品」 */
rep('tabs',
  "const RADAR_TABS = [['overview', '概览'], ['videos', '视频'], ['posts', '帖子'], ['articles', '文章'], ['keywords', '关键词'], ['competitors', '同行网站'], ['sources', '来源状态']];",
  "const RADAR_TABS = [['overview', '概览'], ['videos', '视频'], ['posts', '帖子'], ['articles', '文章'], ['products', '商品'], ['keywords', '关键词'], ['competitors', '同行网站'], ['sources', '来源状态']];");

/* 2) counts 加 products */
rep('counts',
  "    videos: r.videos.length, posts: r.posts.length, articles: r.articles.length,",
  "    videos: r.videos.length, posts: r.posts.length, articles: r.articles.length, products: (r.products || []).length,");

/* 3) 商品面板 */
rep('products-panel',
  "    keywords: () => `<div class=\"panel\" style=\"margin-top:14px\">",
  `    products: () => \`<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>商品样本 · \${counts.products}</h2><div class="row tight"><span class="hint">Amazon 搜索 + Alibaba 国际站（浏览器自动化抓取，模拟真实点击）</span><button class="btn ghost tiny" data-reroll="products">换一批</button></div></div>
      <div class="media-grid">\${(r.products || []).map((g) => \`<div class="media-card">
        <div class="thumb tall">\${g.thumb ? \`<img src="/api/thumb?u=\${encodeURIComponent(g.thumb)}" alt="" loading="lazy" />\` : '<div class="ph">无图</div>'}
          <span class="plat">\${g.source === 'amazon' ? 'Amazon' : 'Alibaba'}</span>
        </div>
        <div class="body">
          <a class="title" href="\${esc(g.url)}" target="_blank" rel="noreferrer">\${esc((g.title || '').slice(0, 110))}</a>
          <div class="meta">
            \${g.price ? \`<span>\${esc(g.price)}</span>\` : ''}
            \${g.rating ? \`<span>★ \${g.rating}</span>\` : ''}
            \${g.reviews ? \`<span>\${fmt(g.reviews)} 评价</span>\` : ''}
            \${g.bought ? \`<span>\${esc(g.bought)} bought</span>\` : ''}
            \${g.moq ? \`<span>MOQ \${esc(g.moq)}</span>\` : ''}
          </div>
        </div>
        <div class="foot"><span></span><a class="btn ghost tiny" href="\${esc(g.url)}" target="_blank" rel="noreferrer">打开</a></div>
      </div>\`).join('') || '<div class="empty" style="grid-column:1/-1">商品还没抓到（Amazon 可能有验证码，换一批试试）</div>'}</div>
      <p class="muted" style="margin-top:12px;font-size:11.5px">抓的是公开搜索结果页：标题、价格、评分、评价数、MOQ。用于看买家在买什么、什么价位、包装长什么样。</p>
    </div>\`,
    keywords: () => \`<div class="panel" style="margin-top:14px">`);

writeFileSync(p, a, 'utf8');
console.log('done:', done.join(', '));
