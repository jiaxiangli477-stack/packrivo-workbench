import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const block = `  $$('[data-exp]').forEach((b) => (b.onclick = () => {
    const row = $('#res-' + b.dataset.exp);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '展开' : '收起';
  }));
  const syncBtn = $('[data-sync-bsky]');
  if (syncBtn) syncBtn.onclick = async () => {
    syncBtn.disabled = true; syncBtn.textContent = '同步中…';
    try {
      const r = await api('/api/metrics/sync-bsky', 'POST', {});
      toast('已同步 ' + r.updated + ' 条互动数据');
      setTimeout(viewResults, 900);
    } catch (e) { toast(e.message, true); }
    syncBtn.disabled = false; syncBtn.textContent = '同步互动数据';
  };
  // 默认展开最新一条，直接看到配图与互动
  const firstExp = document.querySelector('[data-exp]');
  if (firstExp) firstExp.click();`;

/* 1) 从 viewGraph 里摘掉错放的块 */
if (c.includes(block)) {
  c = c.replace(block + '\n', '');
  console.log('removed misplaced block');
}

/* 2) 放进 viewResults 末尾 */
const startIdx = c.indexOf('async function viewResults()');
if (startIdx < 0) { console.log('no viewResults'); process.exit(1); }
const nextFn = c.indexOf('function sTag(', startIdx);
if (nextFn < 0) { console.log('no sTag boundary'); process.exit(1); }
const seg = c.slice(startIdx, nextFn);
const lastBrace = seg.lastIndexOf('\n}');
if (lastBrace < 0) { console.log('no closing brace'); process.exit(1); }
const insertAt = startIdx + lastBrace;
c = c.slice(0, insertAt) + '\n' + block + c.slice(insertAt);

writeFileSync(p, c, 'utf8');
console.log('bindings moved into viewResults');
