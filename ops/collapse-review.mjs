import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

/* ---------- 1) 审核队列：折叠卡片 ---------- */
const startMark = '      ${contents.length ? contents.map((c) => `';
const endMark = '        </div>`).join(\'\') : \'<div class="empty">队列是空的，去「AI 二创」生成一批</div>\'}';
const i = c.indexOf(startMark);
const j = c.indexOf(endMark);
if (i < 0 || j < 0) { console.log('review anchors missing', i, j); process.exit(1); }

const block = [
  '      ${contents.length ? contents.map((c) => `',
  '        <details class="rv-card">',
  '          <summary>',
  '            <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:nowrap">',
  '              <div class="row tight" style="align-items:center;min-width:0;flex:1">',
  '                <span class="tag info">${esc(pname(c.platform))}</span>',
  '                <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title || (c.body || \'\').slice(0, 60) || \'(无标题)\')}</strong>',
  '                <span class="muted" style="font-size:12px;white-space:nowrap">#${c.id} · ${esc(c.lang)}${c.similarity != null ? \' · 相似度 \' + c.similarity + \'%\' : \'\'}</span>',
  '              </div>',
  '              <div class="row tight" style="flex-shrink:0">',
  '                <button class="btn ghost tiny" data-ai="${c.id}">AI 预审</button>',
  '                <button class="btn ghost tiny" data-anlc="${c.id}">AI 分析</button>',
  '                <button class="btn ghost tiny" data-imgprompt="${c.id}">配图提示词</button>',
  '                <button class="btn ghost tiny" data-ok="${c.id}">通过</button>',
  '                <button class="btn danger tiny" data-no="${c.id}">打回</button>',
  '              </div>',
  '            </div>',
  '          </summary>',
  '          <div class="rv-body">',
  '            ${c.image_path ? `<img src="/api/media/${esc(String(c.image_path).split(/[\\\\/]/).pop())}" style="max-width:320px;border-radius:10px;margin-bottom:10px" />` : \'\'}',
  '            <div class="pre">${esc(c.body)}</div>',
  '            <div data-anlout="${c.id}" style="display:none"></div>',
  '            <div class="muted" style="margin-top:8px;font-size:12px">标签 ${esc(c.hashtags || \'—\')} · UTM <span class="mono">${esc(c.utm_url)}</span></div>',
  '            <div class="row" style="margin-top:10px">',
  '              <div class="field"><label>发到账号</label><select data-acc="${c.id}">${accounts.some((a) => a.platform === c.platform) ? "" : `<option value="" selected disabled>⚠ 还没有 ${esc(c.platform)} 账号，先去「账号」页添加</option>`}${accounts.map((a) => `<option value="${a.id}" ${a.platform === c.platform ? \'selected\' : \'\'}>${esc(pname(a.platform))} / ${esc(a.handle)}</option>`).join(\'\')}</select></div>',
  '              <div class="field"><label>时间</label><input type="datetime-local" data-when="${c.id}" /></div>',
  '              <button class="btn ghost tiny" data-sch="${c.id}">排期</button>',
  '            </div>',
  '            <div class="pre mono" data-aio="${c.id}" style="display:none;margin-top:10px"></div>',
  '          </div>',
  '        </details>`).join(\'\')',
].join('\n');

c = c.slice(0, i) + block + '\n' + c.slice(j + endMark.length);

/* 操作按钮不要触发折叠 */
for (const attr of ['data-ai', 'data-anlc', 'data-imgprompt']) {
  const old = "$$('[" + attr + "]').forEach((b) => (b.onclick = async () => {";
  const neu = "$$('[" + attr + "]').forEach((b) => (b.onclick = async (ev) => {\n    ev.preventDefault(); ev.stopPropagation();";
  if (c.includes(old)) c = c.replace(old, () => neu);
}
for (const attr of ['data-ok', 'data-no', 'data-sch', 'data-now']) {
  const old = "$$('[" + attr + "]').forEach((b) => (b.onclick = async () => {";
  const neu = "$$('[" + attr + "]').forEach((b) => (b.onclick = async (ev) => {\n    ev.preventDefault(); ev.stopPropagation();";
  if (c.includes(old)) c = c.replace(old, () => neu);
}

writeFileSync(p, c, 'utf8');
console.log('review cards collapsed');

/* ---------- 2) 样式 ---------- */
const cp = 'E:/破甲工作区/social-workbench/web/style.css';
let css = readFileSync(cp, 'utf8');
if (!css.includes('.rv-card')) {
  css += `

/* 折叠卡片（审核队列 / 排期 / 发布结果） */
.rv-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  margin-bottom: 10px;
  overflow: hidden;
}
.rv-card > summary {
  list-style: none;
  cursor: pointer;
  padding: 12px 14px;
  display: block;
}
.rv-card > summary::-webkit-details-marker { display: none; }
.rv-card > summary:hover { background: rgba(127,176,255,.06); }
.rv-card[open] > summary { border-bottom: 1px solid var(--line-soft); }
.rv-card > summary::before {
  content: '▸';
  color: var(--muted);
  margin-right: 8px;
  display: inline-block;
  transition: transform .15s;
}
.rv-card[open] > summary::before { transform: rotate(90deg); }
.rv-body { padding: 12px 14px; }
`;
  writeFileSync(cp, css, 'utf8');
  console.log('rv-card css added');
}
