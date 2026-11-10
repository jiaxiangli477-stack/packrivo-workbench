import { readFileSync, writeFileSync } from 'node:fs';

const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const before = c.length;
const applied = [];
const fail = [];

function rep(name, from, to) {
  if (!c.includes(from)) { fail.push(name); return; }
  c = c.replace(from, to);
  applied.push(name);
}

/* 1) 关键词子版块改成表格：词 / 位次 / AI 判定 / 趋势链接 */
const oldKw = `    keywords: () => \`<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>关键词机会 · \${counts.keywords}</h2><span class="hint">Google 联想词，可整组并入关键词库</span></div>
      \${(r.keywords || []).map((g) => \`<div style="margin-bottom:14px">
        <div class="nav-label" style="padding-left:0">\${esc(g.seed)}</div>
        <div class="pill-list">\${g.suggestions.map((s) => \`<span class="tag">\${esc(s)}</span>\`).join('') || '<span class="muted">无</span>'}
          \${g.suggestions.length ? \`<button class="btn ghost tiny" data-add-kw="\${esc(g.seed)}">整组加入</button>\` : ''}</div>
      </div>\`).join('') || '<div class="empty">没抓到联想词</div>'}</div>\`,`;

const newKw = `    keywords: () => \`<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>关键词机会 · \${counts.keywords}</h2><span class="hint">无免费搜索量接口：用「联想位次 + AI 相关性分」代替，点趋势看 Google 真实曲线</span></div>
      \${(r.keywords || []).map((g) => {
        const rows = (g.suggestions || []);
        const keepRows = rows.filter((x) => !x.ai || x.ai.verdict !== 'drop');
        return \`<div style="margin-bottom:16px">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="nav-label" style="padding-left:0">\${esc(g.seed)} · \${rows.length} 个，AI 留下 \${keepRows.length}</div>
            <button class="btn ghost tiny" data-add-kw="\${esc(g.seed)}">把留下的加入关键词库</button>
          </div>
          <table><thead><tr><th>关键词</th><th>联想位次</th><th>AI 相关性</th><th>判定</th><th>趋势</th></tr></thead><tbody>
          \${rows.map((x) => \`<tr>
            <td>\${esc(x.word || x)}</td>
            <td class="num">#\${x.position || '-'}</td>
            <td class="num">\${x.ai ? x.ai.score : '—'}</td>
            <td>\${!x.ai ? '<span class="tag mute">未审</span>' : x.ai.verdict === 'drop' ? '<span class="tag bad">丢弃</span>' : \`<span class="tag ok">保留</span><div class="muted" style="font-size:10.5px">\${esc(x.ai.reason || '')}</div>\`}</td>
            <td><a class="btn ghost tiny" href="https://trends.google.com/trends/explore?q=\${encodeURIComponent(x.word || x)}&geo=US" target="_blank" rel="noreferrer">看趋势</a></td>
          </tr>\`).join('')}
          </tbody></table>
        </div>\`;
      }).join('') || '<div class="empty">没抓到联想词</div>'}
    </div>\`,`;
rep('keywords-table', oldKw, newKw);

/* 2) 视频卡加 AI 标记 */
rep('video-ai',
  `<div class="meta"><span>\${fmt(v.stats?.views || 0)} 播放</span><span>\${esc(v.author || '')}</span><span>\${v.days >= 999 ? '—' : v.days + ' 天前'}</span></div>`,
  `<div class="meta"><span>\${fmt(v.stats?.views || 0)} 播放</span><span>\${esc(v.author || '')}</span><span>\${v.days >= 999 ? '—' : v.days + ' 天前'}</span></div>
      \${v.ai ? \`<div class="muted" style="font-size:10.5px">\${v.ai.verdict === 'drop' ? '<span class="tag bad">AI 判丢弃</span>' : '<span class="tag ok">AI ' + v.ai.score + '</span>'} \${esc(v.ai.reason || '')}</div>\` : ''}`);

/* 3) 帖子卡加 AI 标记 */
rep('post-ai',
  `      <div class="foot"><span></span><button class="btn ghost tiny" data-save-post="\${i}">入库</button></div>`,
  `      \${p.ai ? \`<div class="muted" style="font-size:10.5px">\${p.ai.verdict === 'drop' ? '<span class="tag bad">AI 判丢弃</span>' : '<span class="tag ok">AI ' + p.ai.score + '</span>'} \${esc(p.ai.reason || '')}</div>\` : ''}
      <div class="foot"><span></span><button class="btn ghost tiny" data-save-post="\${i}">入库</button></div>`);

/* 4) 文章行加 AI 标记 */
rep('article-ai',
  `<div class="muted" style="font-size:11px">\${esc(a.author || '')} · \${a.days >= 999 ? '—' : a.days + ' 天前'} · 估 \${a.score}</div></div>
        <button class="btn ghost tiny" data-save-article="\${i}">入库</button></div>`,
  `<div class="muted" style="font-size:11px">\${esc(a.author || '')} · \${a.days >= 999 ? '—' : a.days + ' 天前'} · 估 \${a.score}
          \${a.ai ? (a.ai.verdict === 'drop' ? ' · <span class="tag bad">AI 判丢弃</span>' : ' · <span class="tag ok">AI ' + a.ai.score + '</span>') : ''}
          \${a.ai && a.ai.reason ? '<br>' + esc(a.ai.reason) : ''}</div></div>
        <button class="btn ghost tiny" data-save-article="\${i}">入库</button></div>`);

/* 5) header 增加审查摘要 */
rep('audit-summary',
  `      <span class="tag mute">TikTok/IG/Reddit 需 Apify</span>
    </div>
  </div>\`;`,
  `      <span class="tag mute">TikTok/IG/Reddit 需 Apify</span>
      \${r.audit && r.audit.items && r.audit.items.length ? \`<span class="tag ok">kimi 已审 \${r.audit.items.length + (r.audit.keywords || []).length} 条 · 丢弃 \${[...(r.audit.items || []), ...(r.audit.keywords || [])].filter((x) => x.verdict === 'drop').length}</span>\` : '<span class="tag mute">AI 未审</span>'}
    </div>
    \${r.audit && r.audit.summary ? \`<p class="muted" style="margin:8px 0 0;font-size:11.5px">\${esc(r.audit.summary)}</p>\` : ''}
  </div>\`;`);

/* 6) 整组加入：从对象取 word，只加保留项 */
rep('add-kw-handler',
  `    const { keywords } = await api('/api/keywords');
    const merged = [...new Set([...keywords, ...g.suggestions])];`,
  `    const { keywords } = await api('/api/keywords');
    const words = (g.suggestions || []).filter((x) => !x.ai || x.ai.verdict !== 'drop').map((x) => x.word || x);
    const merged = [...new Set([...keywords, ...words])];`);

writeFileSync(p, c, 'utf8');
console.log('applied:', applied.join(', '));
if (fail.length) console.log('FAILED:', fail.join(', '));
console.log('size', before, '->', c.length);
