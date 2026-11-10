import { chromium } from 'playwright-core';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());

console.log('frames:', page.frames().map((f) => f.url()));
const root = page.frames().find((f) => f.url().includes('registration'));

for (const f of page.frames()) {
  const btns = await f.locator('button,[role="button"],a').evaluateAll((els) =>
    els.map((e) => ({ tag: e.tagName, text: (e.innerText || '').trim().slice(0, 20), id: e.id || '' })).filter((x) => x.text).slice(0, 25)
  ).catch(() => []);
  if (btns.length) console.log('frame', f.url().slice(0, 80), '→', JSON.stringify(btns));
}

// 在 registration 帧里点"继续"
const r = page.frames().find((f) => f.url().includes('registration/dialog'));
if (r) {
  const btn = r.locator('button:has-text("继续")').first();
  console.log('找到继续按钮:', await btn.count());
  if (await btn.count()) {
    await btn.click({ timeout: 15000 }).catch((e) => console.log('click err', e.message));
    await page.waitForTimeout(5000);
  }
  const t = await r.locator('body').innerText().catch(() => '');
  console.log('--- 点击后（registration 帧）---');
  console.log(t.slice(0, 700));
}
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/meta-reg3.png', timeout: 20000 }).catch(() => {});
await b.close();
