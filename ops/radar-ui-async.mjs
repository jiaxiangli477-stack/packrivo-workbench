import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const old = `      $('#w-status').textContent = '抓取中：关键词联想 → 热门视频 → 热门文章 → 同行网站…（约 20-40 秒）';
      await api('/api/radar/refresh', 'POST', {});
      toast('情报已更新');
      viewRadar();`;

const neu = `      const start = await api('/api/radar/refresh', 'POST', {});
      if (!start.started) {
        $('#w-status').textContent = '上一轮还在抓：' + (start.stage || '') + '，稍等…';
      } else {
        $('#w-status').textContent = '抓取中：准备…';
      }
      // 后台异步抓取，轮询进度，避免按钮看起来"点了没反应"
      const timer = setInterval(async () => {
        try {
          const st = await api('/api/radar/refresh');
          if (st.running) {
            $('#w-status').textContent = '抓取中：' + (st.stage || '…') + '（这一步要几十秒）';
            return;
          }
          clearInterval(timer);
          if (st.error) { toast('抓取失败：' + st.error, true); $('#w-status').textContent = ''; }
          else {
            const cnt = st.counts || {};
            toast('情报已更新：视频 ' + (cnt.videos || 0) + ' · 帖子 ' + (cnt.posts || 0) + ' · 文章 ' + (cnt.articles || 0) + ' · 商品 ' + (cnt.products || 0));
            $('#w-status').textContent = '';
            viewRadar();
          }
        } catch (e) { clearInterval(timer); toast(e.message, true); $('#w-status').textContent = ''; }
      }, 3000);`;

if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('ui patched: radar refresh async polling');
