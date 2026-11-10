import { chromium } from 'playwright-core';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true });
const page = await ctx.newPage();
for (const url of ['https://m.alibaba.com/products/jewelry-gift-box.html', 'https://www.alibaba.com/showroom/jewelry-gift-box.html?spm=a2700.galleryofferlist']) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);
    const html = await page.content();
    const cap = /drag the slider|CAPTCHA|verify/i.test(html.slice(0, 5000));
    const links = await page.$$eval('a[href*="product-detail"]', (as) => as.length);
    console.log(url.slice(0, 55), '| captcha:', cap, '| product links:', links, '| len:', html.length);
  } catch (e) { console.log(url.slice(0, 55), 'ERR', e.message.slice(0, 60)); }
}
await browser.close();
