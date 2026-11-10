import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

/* 展开行改成：配图 + 正文 + 互动数据 + 链接 */
const oldStart = '        <tr class="res-detail" id="res-${r.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">';
const oldEnd = '        </td></tr>`).join(\'\')}';
const i = c.indexOf(oldStart);
const j = c.indexOf(oldEnd);
if (i < 0 || j < 0) { console.log('anchors missing', i, j); process.exit(1); }

const block = [
  '        <tr class="res-detail" id="res-${r.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">',
  '          <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">',
  '            ${r.image_path ? `<img src="/api/media/${esc(String(r.image_path).split(/[\\\\/]/).pop())}" style="width:180px;height:180px;object-fit:cover;border-radius:10px;border:1px solid var(--line)" />` : \'<div class="empty" style="width:180px;height:180px">无配图</div>\'}',
  '            <div style="flex:1;min-width:280px">',
  '              <div class="nav-label" style="padding-left:0">正文</div>',
  '              <div class="muted" style="font-size:12.5px;white-space:pre-wrap;max-height:120px;overflow:auto">${esc((r.body || \'\').slice(0, 500))}</div>',
  '              <div class="row" style="gap:16px;margin-top:10px">',
  '                <div><div class="nav-label" style="padding-left:0">互动</div><span class="mono">赞 ${r.likes || 0} · 转 ${r.reposts || 0} · 回 ${r.replies || 0}</span></div>',
  '                <div><div class="nav-label" style="padding-left:0">标签</div><span class="muted" style="font-size:12px">${esc(r.hashtags || \'—\')}</span></div>',
  '                ${r.url ? `<div><div class="nav-label" style="padding-left:0">帖子</div><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></div>` : \'\'}',
  '              </div>',
  '              ${r.detail ? `<div class="muted" style="margin-top:8px;font-size:12px">${esc(r.detail)}</div>` : \'\'}',
  '            </div>',
  '          </div>',
  '        </td></tr>`).join(\'\')}',
].join('\n');

c = c.slice(0, i) + block + c.slice(j + oldEnd.length);

/* 顶部加「同步互动数据」按钮 */
if (!c.includes('data-sync-bsky')) {
  c = c.replace(
    '<div class="panel-head"><h2>发布结果 · ${results.length}</h2><span class="hint">失败会有归因类别，不会假装成功</span></div>',
    '<div class="panel-head"><h2>发布结果 · ${results.length}</h2><div class="row tight"><span class="hint">失败会有归因类别；点「展开」看配图与互动</span><button class="btn ghost tiny" data-sync-bsky>同步互动数据</button></div></div>'
  );
  c = c.replace(
    "  $$('[data-exp]').forEach((b) => (b.onclick = () => {",
    `  const syncBtn = $('[data-sync-bsky]');
  if (syncBtn) syncBtn.onclick = async () => {
    syncBtn.disabled = true; syncBtn.textContent = '同步中…';
    try {
      const r = await api('/api/metrics/sync-bsky', 'POST', {});
      toast('已同步 ' + r.updated + ' 条互动数据');
      setTimeout(viewResults, 800);
    } catch (e) { toast(e.message, true); }
    syncBtn.disabled = false; syncBtn.textContent = '同步互动数据';
  };
  $$('[data-exp]').forEach((b) => (b.onclick = () => {`
  );
}

writeFileSync(p, c, 'utf8');
console.log('results detail + sync button updated');
