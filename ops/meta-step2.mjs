import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);

const cookies = await ctx.cookies('https://www.facebook.com');
const names = cookies.map((c) => c.name);
console.log('有 c_user cookie:', names.includes('c_user'));
console.log('有 xs cookie:', names.includes('xs'));
console.log('url:', page.url());

const txt = await page.locator('body').innerText().catch(() => '');
console.log('--- 页面片段 ---');
console.log(txt.slice(0, 400));

await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-2.png', timeout: 20000 }).catch((e) => console.log('shot fail', e.message));
await b.close();
