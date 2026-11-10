import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const oldStart = '        ${results.map((r) => `<tr><td class="mono">${r.id}</td><td>#${r.content_id} ${esc((r.title || \'\').slice(0, 26))}</td>';
const oldEnd = '<td class="muted">${esc((r.detail || \'\').slice(0, 70))}</td><td class="mono">${esc(r.at)}</td></tr>`).join(\'\')}';
const i = c.indexOf(oldStart);
const j = c.indexOf(oldEnd);
if (i < 0 || j < 0) { console.log('anchors missing', i, j); process.exit(1); }

const block = [
  '        ${results.map((r) => `<tr class="res-row" data-res="${r.id}">',
  '          <td class="mono">${r.id}</td>',
  '          <td>#${r.content_id} ${esc((r.title || \'\').slice(0, 26))}</td>',
  '          <td>${esc(pname(r.platform))}</td>',
  '          <td>${esc(r.channel)}</td>',
  '          <td>${r.ok ? \'<span class="tag ok">成功</span>\' : `<span class="tag bad">${esc(r.error_class || \'失败\')}</span>`}</td>',
  '          <td class="mono">${esc(r.platform_post_id || \'\')}</td>',
  '          <td class="mono">${esc(r.at)}</td>',
  '          <td><button class="btn ghost tiny" data-exp="${r.id}">展开</button></td>',
  '        </tr>',
  '        <tr class="res-detail" id="res-${r.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">',
  '          <div class="row" style="gap:24px;flex-wrap:wrap">',
  '            ${r.url ? `<div><div class="nav-label" style="padding-left:0">帖子链接</div><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></div>` : \'\'}',
  '            <div style="flex:1;min-width:240px"><div class="nav-label" style="padding-left:0">详情</div><div class="muted" style="font-size:12px;white-space:pre-wrap">${esc(r.detail || \'—\')}</div></div>',
  '            ${r.schedule_id ? `<div><div class="nav-label" style="padding-left:0">排期</div><span class="mono">#${r.schedule_id}</span></div>` : \'\'}',
  '          </div>',
  '        </td></tr>`).join(\'\')}',
].join('\n');

c = c.slice(0, i) + block + c.slice(j + oldEnd.length);

/* 绑定展开 */
c = c.replace(
  '  };\n}\n\n\n/* ================= 工作流 ================= */',
  `  };
  $$('[data-exp]').forEach((b) => (b.onclick = () => {
    const row = $('#res-' + b.dataset.exp);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '展开' : '收起';
  }));
}

/* ================= 工作流 ================= */`
);

writeFileSync(p, c, 'utf8');
console.log('results rows expandable');
