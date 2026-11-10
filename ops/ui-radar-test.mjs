import { chromium } from 'playwright-core';

const b = await chromium.launch({ channel: 'msedge', headless: true });
const page = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));

await page.goto('http://127.0.0.1:8795/#radar', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const btn = page.locator('#r-refresh');
console.log('按钮存在:', await btn.count());
console.log('按钮文案:', (await btn.innerText().catch(() => '')).trim());

await btn.click({ timeout: 10000 }).catch((e) => console.log('点击失败', e.message));

for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(4000);
  const t = (await btn.innerText().catch(() => '')).trim();
  const st = (await page.locator('#w-status').innerText().catch(() => '')).trim();
  console.log(`t=${(i + 1) * 4}s 按钮="${t}" 状态="${st}"`);
}

console.log('页面报错:', errors.length ? errors.join(' | ') : '无');
await page.screenshot({ path: 'E:/破甲工作区/social-workbench/ops/shot43-radar-click.png' });
await b.close();
