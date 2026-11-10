import { chromium } from 'playwright-core';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();

for (const url of ['https://www.alibaba.com/showroom/jewelry-gift-box.html', 'https://www.alibaba.com/trade/search?SearchText=jewelry+gift+box']) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const title = await page.title();
    const info = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="product-detail"]')].slice(0, 3).map((a) => a.href);
      const cards = [...document.querySelectorAll('[class*="card"], [class*="Card"], [data-content]')].slice(0, 6).map((el) => el.className.toString().slice(0, 60));
      return { links, cards, bodyLen: document.body.innerText.length, sample: document.body.innerText.slice(0, 200).replace(/\s+/g, ' ') };
    });
    console.log('===', url.slice(0, 60), '|', title.slice(0, 60));
    console.log(' product links:', info.links.length, info.links.slice(0, 2));
    console.log(' card classes:', info.cards.join(' | '));
    console.log(' text sample:', info.sample);
  } catch (e) { console.log('ERR', url.slice(0, 50), e.message.slice(0, 90)); }
}
await browser.close();
