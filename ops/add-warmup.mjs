import { readFileSync, writeFileSync } from 'node:fs';

/* server: warmup endpoint */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/api/products/warmup')) {
  s = s.replace(
    "import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';",
    "import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';\nimport { warmupAlibaba } from './browser.mjs';"
  );
  s = s.replace(
    "/* ---------- 配图提示词",
    `/* 阿里巴巴人机验证：开一个有头窗口，用户自己拖一次滑块，cookie 存进 profile 后复用 */
on('POST', /^\\/api\\/products\\/warmup$/, async (m, b) => {
  const keyword = String(b.keyword || 'jewelry gift box');
  const r = await warmupAlibaba(keyword);
  audit('alibaba.warmup', keyword, r);
  return r;
});

/* ---------- 配图提示词`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server warmup added');
}

/* UI: 商品面板加按钮 */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
const old = `<button class="btn ghost tiny" data-reroll="products">换一批</button></div></div>`;
const neu = `<button class="btn ghost tiny" id="alibaba-warm">阿里过人机验证</button><button class="btn ghost tiny" data-reroll="products">换一批</button></div></div>`;
if (a.includes(old)) {
  a = a.replace(old, neu);
  a = a.replace(
    "  $$('[data-reroll]').forEach((b) => (b.onclick = async () => {",
    `  const warm = $('#alibaba-warm');
  if (warm) warm.onclick = async () => {
    warm.disabled = true; warm.textContent = '弹出窗口，请拖滑块…';
    try {
      const r = await api('/api/products/warmup', 'POST', { keyword: 'jewelry gift box' });
      toast(r.ok ? '验证通过，可以换一批抓阿里了' : '没等到验证通过（3 分钟超时）', !r.ok);
    } catch (e) { toast(e.message, true); }
    warm.disabled = false; warm.textContent = '阿里过人机验证';
  };
  $$('[data-reroll]').forEach((b) => (b.onclick = async () => {`
  );
  writeFileSync(a, a, 'utf8');
  console.log('ui warmup button added');
} else {
  console.log('ui anchor missing');
}
