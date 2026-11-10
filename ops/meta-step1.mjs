import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const pages = ctx.pages();
console.log('pages:', pages.length);
const page = pages[0] || (await ctx.newPage());

if (!page.url().includes('developers.facebook.com')) {
  await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'domcontentloaded', timeout: 60000 });
}
await page.waitForTimeout(4000);
console.log('url:', page.url());
console.log('title:', await page.title());
const txt = await page.locator('body').innerText().catch(() => '');
console.log('--- body head ---');
console.log(txt.slice(0, 900));
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-1.png', fullPage: false });
await b.close();
