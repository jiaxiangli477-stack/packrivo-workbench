import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const startMark = "    products: () => `<div class=\"panel\" style=\"margin-top:14px\">";
const endMark = "    keywords: () => `<div class=\"panel\" style=\"margin-top:14px\">";
const i = c.indexOf(startMark);
const j = c.indexOf(endMark);
if (i < 0 || j < 0 || j < i) { console.log('anchor missing', i, j); process.exit(1); }

const block = `    products: () => {
      const num = (s) => {
        const m = String(s || '').replace(/,/g, '').match(/([\\d.]+)\\s*([kKmM])?/);
        if (!m) return 0;
        let v = parseFloat(m[1]);
        if (m[2]) v *= /k/i.test(m[2]) ? 1000 : 1000000;
        return v;
      };
      const list = [...(r.products || [])].sort((a, b) => num(b.bought) - num(a.bought) || num(b.reviews) - num(a.reviews));
      return \`<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>商品样本 · \${list.length}</h2><div class="row tight"><span class="hint">Amazon 搜索（浏览器自动化）· 按「月销」排序</span><button class="btn ghost tiny" id="alibaba-warm">阿里过人机验证</button><button class="btn ghost tiny" data-reroll="products">换一批</button></div></div>
      \${list.length ? \`<table class="prod-table"><thead><tr><th style="width:64px">图</th><th>产品</th><th style="width:90px">价格</th><th style="width:76px">评分</th><th style="width:96px">评价数</th><th style="width:92px">月销</th><th style="width:86px">来源</th><th style="width:70px"></th></tr></thead><tbody>
        \${list.map((g) => \`<tr>
          <td>\${g.thumb ? \`<img src="/api/thumb?u=\${encodeURIComponent(g.thumb)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px" loading="lazy" />\` : '<span class="muted">—</span>'}</td>
          <td><a href="\${esc(g.url)}" target="_blank" rel="noreferrer">\${esc((g.title || '').slice(0, 96))}</a></td>
          <td class="num">\${esc(g.price || '—')}</td>
          <td class="num">\${g.rating ? '★ ' + g.rating : '—'}</td>
          <td class="num">\${g.reviews ? fmt(g.reviews) : '—'}</td>
          <td class="num">\${esc(g.bought || g.moq || '—')}</td>
          <td><span class="tag \${g.source === 'amazon' ? 'info' : 'warn'}">\${g.source === 'amazon' ? 'Amazon' : 'Alibaba'}</span></td>
          <td><a class="btn ghost tiny" href="\${esc(g.url)}" target="_blank" rel="noreferrer">打开</a></td>
        </tr>\`).join('')}
      </tbody></table>\` : '<div class="empty">商品还没抓到（Amazon 可能有验证码，换一批试试）</div>'}
      <p class="muted" style="margin-top:12px;font-size:12px">价格为抓取当天的搜索页标价；「月销」是 Amazon 的 "bought in past month"；评价数为页面显示值，个别商品可能抓不全。</p>
    </div>\`;
    },
`;

c = c.slice(0, i) + block + c.slice(j);
writeFileSync(p, c, 'utf8');
console.log('products table rendered');

/* 表格样式 */
const cp = 'E:/破甲工作区/social-workbench/web/style.css';
let css = readFileSync(cp, 'utf8');
if (!css.includes('.prod-table')) {
  css += `

.prod-table td { vertical-align: middle; padding: 8px 10px; }
.prod-table a { color: var(--text); text-decoration: none; }
.prod-table a:hover { color: #7fb0ff; }
.prod-table thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); }
`;
  writeFileSync(cp, css, 'utf8');
  console.log('prod-table css added');
}
