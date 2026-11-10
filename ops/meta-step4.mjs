import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
console.log('url after /apps/:', page.url());

// 如果没有跳到 apps 列表，找"立即开始/开始使用/注册"入口
const body = await page.locator('body').innerText().catch(() => '');
const needRegister = !/我的应用|My Apps|创建应用|Create App/.test(body);
console.log('需要开发者注册流程:', needRegister);

if (needRegister) {
  const targets = ['立即开始', '开始使用', '注册', 'Get Started', 'Register'];
  for (const t of targets) {
    const el = page.getByText(t, { exact: false }).first();
    if (await el.count()) {
      console.log('点击:', t);
      await el.click({ timeout: 15000 }).catch((e) => console.log('点击失败', t, e.message));
      await page.waitForTimeout(5000);
      break;
    }
  }
}

console.log('当前 url:', page.url());
const t2 = await page.locator('body').innerText().catch(() => '');
console.log('--- 当前页面 ---');
console.log(t2.slice(0, 800));
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-reg.png', timeout: 20000 }).catch(() => {});
await b.close();
