import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const oldStart = '        ${schedules.map((s) => `<tr><td class="mono">${s.id}</td>';
const oldEnd = '          <td><button class="btn ghost tiny" data-now="${s.id}">现在发</button></td></tr>`).join(\'\')}';
const i = c.indexOf(oldStart);
const j = c.indexOf(oldEnd);
if (i < 0 || j < 0) { console.log('anchors missing', i, j); process.exit(1); }

const block = [
  '        ${schedules.map((s) => `<tr>',
  '          <td class="mono">${s.id}</td>',
  '          <td>#${s.content_id} ${esc((s.title || \'\').slice(0, 32))}<div class="muted" style="font-size:11px">${esc(s.content_platform)}</div></td>',
  '          <td>${esc(s.handle)}<div class="muted" style="font-size:11px">${esc(s.account_platform)}</div></td>',
  '          <td>${esc(s.channel)}</td>',
  '          <td class="mono">${esc(s.run_at)}</td>',
  '          <td>${sTag(s.state)}</td>',
  '          <td><button class="btn ghost tiny" data-exp-sch="${s.id}">详情</button></td>',
  '          <td><button class="btn ghost tiny" data-now="${s.id}">现在发</button></td>',
  '        </tr>',
  '        <tr class="sch-detail" id="sch-${s.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">',
  '          <div class="row" style="gap:24px;flex-wrap:wrap">',
  '            <div><div class="nav-label" style="padding-left:0">通道 / 状态</div><span class="mono">${esc(s.channel)}</span> · ${sTag(s.state)}</div>',
  '            <div><div class="nav-label" style="padding-left:0">重试</div><span class="mono">${esc(String(s.retry ?? 0))}</span></div>',
  '            <div style="flex:1;min-width:240px"><div class="nav-label" style="padding-left:0">错误</div><div class="muted" style="font-size:12px;white-space:pre-wrap">${esc(s.last_error || \'—\')}</div></div>',
  '            <div><div class="nav-label" style="padding-left:0">创建时间</div><span class="mono">${esc(s.created_at || \'\')}</span></div>',
  '          </div>',
  '        </td></tr>`).join(\'\')}',
].join('\n');

c = c.slice(0, i) + block + c.slice(j + oldEnd.length);

/* 绑定排期展开 */
c = c.replace(
  "  $$('[data-now]').forEach((b) => (b.onclick = async (ev) => {",
  `  $$('[data-exp-sch]').forEach((b) => (b.onclick = () => {
    const row = $('#sch-' + b.dataset.expSch);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '详情' : '收起';
  }));
  $$('[data-now]').forEach((b) => (b.onclick = async (ev) => {`
);

writeFileSync(p, c, 'utf8');
console.log('schedule rows expandable');
