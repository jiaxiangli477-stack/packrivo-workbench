import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.bringToFront().catch(() => {});
console.log('已把受控窗口切到前台，等待你在该窗口登录…');

let ok = false;
for (let i = 0; i < 100; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const cookies = await ctx.cookies('https://www.facebook.com');
  const has = cookies.some((c) => c.name === 'c_user');
  if (has) { ok = true; console.log('检测到登录 cookie，用时约 ' + (i + 1) * 5 + ' 秒'); break; }
  if (i % 6 === 0) console.log('仍在等待登录… (' + (i + 1) * 5 + 's)');
}

if (!ok) { console.log('5 分钟内未检测到登录'); await b.close(); process.exit(1); }

await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(5000);
console.log('url:', page.url());
const txt = await page.locator('body').innerText().catch(() => '');
console.log('--- 页面片段 ---');
console.log(txt.slice(0, 700));
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-3.png', timeout: 25000 }).catch((e) => console.log('shot fail', e.message));
await b.close();
