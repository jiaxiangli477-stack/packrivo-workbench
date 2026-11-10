import { chromium } from 'playwright-core';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE = join(process.cwd(), 'data', 'browser-profile');
mkdirSync(PROFILE, { recursive: true });

let browserPromise = null;
async function getContext(headless = true) {
  if (!browserPromise) {
    browserPromise = chromium.launchPersistentContext(PROFILE, {
      channel: 'msedge',
      headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      userAgent: UA,
      locale: 'en-US',
      viewport: { width: 1366, height: 900 },
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}

async function withPage(fn, headless = true) {
  const ctx = await getContext(headless);
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); }).catch(() => {});
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/* 打开一个有头窗口，让用户手动过一次阿里人机验证；cookie 存进 profile */
export async function warmupAlibaba(keyword = 'jewelry gift box') {
  await closeBrowser();
  const slug = String(keyword).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return withPage(async (page) => {
    await page.goto(`https://www.alibaba.com/showroom/${slug}.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      const n = await page.$eval('a[href*="product-detail"]', (as) => as.length).catch(() => 0);
      if (n > 0) return { ok: true, links: n };
      await page.waitForTimeout(3000);
    }
    return { ok: false, links: 0 };
  }, false);
}

const num = (s) => {
  const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([kKmM])?/);
  if (!m) return 0;
  let v = parseFloat(m[1]);
  if (m[2]) v *= /k/i.test(m[2]) ? 1000 : 1000000;
  return Math.round(v);
};

export async function amazonSearch(query, limit = 8) {
  return withPage(async (page) => {
    await page.goto(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1800);
    const rows = await page.$$eval('div[data-component-type="s-search-result"]', (cards) =>
      cards.map((c) => {
        const txt = c.innerText || '';
        const rev = (txt.match(/\(([\d,]+)\)/) || [])[1] || '';
        const bought = (txt.match(/([\d,.]+[KkMm]?\+?)\s*bought in past month/i) || [])[1] || '';
        return {
          asin: c.getAttribute('data-asin') || '',
          title: (c.querySelector('h2')?.innerText || '').trim(),
          price: (c.querySelector('.a-price .a-offscreen')?.textContent || '').trim(),
          rating: (c.querySelector('.a-icon-alt')?.textContent || '').trim(),
          reviews: (c.querySelector('a[href*="#customerReviews"] span')?.textContent || rev || ((txt.match(/([\d,]+)\s*ratings?/i) || [])[1] || '')).trim(),
          bought,
          img: c.querySelector('img.s-image')?.src || '',
          url: c.getAttribute('data-asin') ? 'https://www.amazon.com/dp/' + c.getAttribute('data-asin') : (c.querySelector('a.a-link-normal')?.href || ''),
        };
      })
    );
    return rows
      .filter((x) => x.title && x.url)
      .map((x) => ({
        source: 'amazon',
        platform: 'amazon',
        kind: 'product',
        title: x.title.slice(0, 140),
        url: x.url,
        asin: x.asin,
        thumb: x.img,
        price: x.price,
        rating: (() => { const m = String(x.rating || '').match(/([\d.]+)\s*out of\s*5/i); return m ? parseFloat(m[1]) : 0; })(),
        reviews: num(x.reviews),
        bought: x.bought,
        query,
        score: Math.min(100, Math.round(30 + 12 * Math.log10((num(x.reviews) || 0) + 1))),
        score_type: 'measured',
      }))
      .slice(0, limit);
  });
}

export async function alibabaSearch(keyword, limit = 8) {
  const slug = String(keyword).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  try {
    return await alibabaOnce(slug, keyword, limit);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 4000));
    try { return await alibabaOnce(slug + '-wholesale', keyword, limit); } catch { throw e; }
  }
}

async function alibabaOnce(slug, keyword, limit = 8) {
  return withPage(async (page) => {
    await page.goto(`https://www.alibaba.com/showroom/${slug}.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    const html = await page.content();
    if (/drag the slider|CAPTCHA Verification/i.test(html)) throw new Error('Alibaba 要求人机验证');
    const rows = await page.$$eval('a[href*="product-detail"]', (links) => {
      const seen = new Set();
      const out = [];
      for (const a of links) {
        const href = a.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);
        const card = a.closest('[class*="card"], [class*="Card"], li, div');
        const txt = (card?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim();
        if (txt.length < 15) continue;
        const img = card?.querySelector('img')?.src || a.querySelector('img')?.src || '';
        const price = (txt.match(/US?\$\s?[\d.,]+(\s*-\s*US?\$\s?[\d.,]+)?/) || [''])[0];
        const moq = (txt.match(/(\d[\d,]*)\s*(pieces|pcs|sets|units|boxes)/i) || [''])[0];
        out.push({ title: txt.slice(0, 140), url: href, img, price, moq });
        if (out.length >= 12) break;
      }
      return out;
    });
    return rows.filter((x) => x.title).map((x) => ({
      source: 'alibaba',
      platform: 'alibaba',
      kind: 'product',
      title: x.title,
      url: x.url,
      thumb: x.img,
      price: x.price,
      moq: x.moq,
      query: keyword,
      score: 55,
      score_type: 'estimated',
    })).slice(0, limit);
  });
}

export async function scrapeProducts(queries = []) {
  const out = [];
  const errors = [];
  for (const q of queries) {
    try { out.push(...(await amazonSearch(q, 8))); } catch (e) { errors.push({ part: 'amazon', query: q, error: e.message }); }
    try { out.push(...(await alibabaSearch(q, 8))); } catch (e) { errors.push({ part: 'alibaba', query: q, error: e.message }); }
  }
  return { items: out, errors };
}
