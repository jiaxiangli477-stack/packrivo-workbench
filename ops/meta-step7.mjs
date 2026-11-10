import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());
const r = page.frames().find((f) => f.url().includes('registration/dialog'));
if (!r) { console.log('未找到注册对话框帧'); await b.close(); process.exit(1); }

const cont = r.locator('div').filter({ hasText: /^继续$/ }).last();
console.log('继续元素数量:', await cont.count());
await cont.click({ timeout: 15000 }).catch((e) => console.log('click err', e.message));
await page.waitForTimeout(6000);

const t = await r.locator('body').innerText().catch(() => '');
console.log('--- 现在 ---');
console.log(t.slice(0, 800));
const inputs = await r.locator('input,select,textarea').evaluateAll((els) =>
  els.map((e) => ({ type: e.type, name: e.getAttribute('name') || '', ph: e.getAttribute('placeholder') || '', aria: e.getAttribute('aria-label') || '' }))
);
console.log('控件:', JSON.stringify(inputs));
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-reg4.png', timeout: 20000 }).catch(() => {});
await b.close();
