import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

const clickText = async (t) => {
  const el = page.getByText(t, { exact: false }).first();
  if (!(await el.count())) return false;
  await el.click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  return true;
};

await clickText('继续');
await page.waitForTimeout(3000);
console.log('url:', page.url());

const dump = async (label) => {
  const t = await page.locator('body').innerText().catch(() => '');
  console.log(`--- ${label} ---`);
  console.log(t.slice(0, 900));
};
await dump('继续之后');

const inputs = await page.locator('input,select,textarea').evaluateAll((els) =>
  els.map((e) => ({ name: e.getAttribute('name') || '', type: e.type, ph: e.getAttribute('placeholder') || '', aria: e.getAttribute('aria-label') || '' })).slice(0, 20)
);
console.log('--- 表单控件 ---');
console.log(JSON.stringify(inputs, null, 1));

await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-reg2.png', timeout: 20000 }).catch(() => {});
await b.close();
