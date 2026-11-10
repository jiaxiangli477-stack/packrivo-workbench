import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

if (!c.includes("$$('[data-exp]').forEach")) {
  const startIdx = c.indexOf('async function viewResults()');
  if (startIdx < 0) { console.log('no viewResults'); process.exit(1); }
  const tail = c.slice(startIdx);
  const endRel = tail.indexOf('\n}\n');
  if (endRel < 0) { console.log('no function end'); process.exit(1); }

  const bindings = `
  $$('[data-exp]').forEach((b) => (b.onclick = () => {
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
  if (firstExp) firstExp.click();
`;

  const insertAt = startIdx + endRel;
  c = c.slice(0, insertAt) + bindings + c.slice(insertAt);
  writeFileSync(p, c, 'utf8');
  console.log('bindings restored for viewResults');
} else {
  console.log('bindings already present');
}
