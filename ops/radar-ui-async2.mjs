import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

/* 通用：触发后台抓取并按 3 秒轮询进度 */
if (!c.includes('async function runRadarRefresh')) {
  c += `

/* 情报刷新：后台异步抓 + 轮询进度（避免点了按钮像没反应） */
async function runRadarRefresh(btn, statusEl) {
  if (btn) { btn.disabled = true; btn.textContent = '抓取中…'; }
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
  try {
    const start = await api('/api/radar/refresh', 'POST', {});
    setStatus(start.started ? '抓取中：准备…' : ('上一轮还在抓：' + (start.stage || '') + '，稍等…'));
    await new Promise((resolve) => {
      const timer = setInterval(async () => {
        try {
          const st = await api('/api/radar/refresh');
          if (st.running) { setStatus('抓取中：' + (st.stage || '…') + '（这步要几十秒）'); return; }
          clearInterval(timer);
          if (st.error) { toast('抓取失败：' + st.error, true); setStatus(''); }
          else {
            const n = st.counts || {};
            toast('情报已更新：视频 ' + (n.videos || 0) + ' · 帖子 ' + (n.posts || 0) + ' · 文章 ' + (n.articles || 0) + ' · 商品 ' + (n.products || 0));
            setStatus('');
          }
          resolve();
        } catch (e) { clearInterval(timer); toast(e.message, true); setStatus(''); resolve(); }
      }, 3000);
    });
    viewRadar();
  } catch (e) {
    toast(e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = '刷新情报'; }
    setStatus('');
  }
}
`;
  done.push('helper');
}

rep('site-A',
  "      $('#w-status').textContent = '抓取中：关键词联想 → 热门视频 → 热门文章 → 同行网站…（约 20-40 秒）';\n      await api('/api/radar/refresh', 'POST', {});\n      toast('情报已更新');\n      viewRadar();",
  "      await runRadarRefresh(btn, $('#w-status'));");

rep('site-B',
  "    try { await api('/api/radar/refresh', 'POST', {}); toast('已刷新'); viewRadar(); }\n    catch (e) { toast(e.message, true); refresh.disabled = false; refresh.textContent = '刷新情报'; }",
  "    try { await runRadarRefresh(refresh, $('#w-status')); }\n    catch (e) { toast(e.message, true); refresh.disabled = false; refresh.textContent = '刷新情报'; }");

writeFileSync(p, c, 'utf8');
console.log('patched:', done.join(', '));
