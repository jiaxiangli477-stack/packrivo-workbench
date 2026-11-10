import { chromium } from 'playwright-core';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function run(url, label, pick) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    const title = await page.title();
    const html = await page.content();
    console.log('===', label, '| title:', title.slice(0, 80), '| len:', html.length, '| ms:', Date.now() - t0);
    console.log('captcha?', /captcha|robot check|verify you are human|enter the characters/i.test(html));
    const items = await pick(page);
    console.log('items:', items.length);
    items.slice(0, 4).forEach((x) => console.log('  -', JSON.stringify(x).slice(0, 220)));
  } catch (e) {
    console.log('===', label, 'ERR', e.message.slice(0, 120));
  } finally {
    await browser.close();
  }
}

await run('https://www.amazon.com/s?k=jewelry+gift+box', 'amazon', async (page) =>
  page.$$eval('div[data-component-type="s-search-result"]', (cards) =>
    cards.slice(0, 8).map((c) => ({
      title: (c.querySelector('h2')?.innerText || '').trim().slice(0, 90),
      price: (c.querySelector('.a-price .a-offscreen')?.textContent || '').trim(),
      rating: (c.querySelector('.a-icon-alt')?.textContent || '').trim().slice(0, 20),
      reviews: (c.querySelector('.a-size-base.s-underline-text')?.textContent || '').trim(),
      img: c.querySelector('img.s-image')?.src || '',
      url: c.querySelector('a.a-link-normal')?.href || '',
    })).filter((x) => x.title)
  )
);

await run('https://www.alibaba.com/trade/search?SearchText=jewelry+gift+box', 'alibaba', async (page) =>
  page.$$eval('div.fy23-search-card, div.organic-list-offer-outter, div[class*="search-card"]', (cards) =>
    cards.slice(0, 8).map((c) => ({
      title: (c.innerText || '').split('\n').filter(Boolean)[0]?.slice(0, 90) || '',
      price: (c.innerText.match(/\$\s?[\d.,]+/) || [''])[0],
      img: c.querySelector('img')?.src || '',
      url: c.querySelector('a')?.href || '',
    })).filter((x) => x.title)
  )
);
