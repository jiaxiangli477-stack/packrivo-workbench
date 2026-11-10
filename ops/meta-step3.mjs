import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
console.log('url:', page.url());

const txt = await page.locator('body').innerText().catch(() => '');
console.log('--- 文本 ---');
console.log(txt.slice(0, 1200));

const btns = await page.locator('a,button,[role="button"]').evaluateAll((els) =>
  els.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter((t) => t && t.length < 40).slice(0, 60)
);
console.log('--- 可点元素 ---');
console.log([...new Set(btns)].join(' | '));

await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-apps.png', timeout: 25000 }).catch((e) => console.log('shot fail', e.message));
await b.close();
