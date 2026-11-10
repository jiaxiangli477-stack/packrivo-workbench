import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const old = `  let products = [];
  try {
    const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
    const scraped = await scrapeProducts(queries);
    products = scraped.items || [];
    errors.push(...(scraped.errors || []));
  } catch (e) {
    errors.push({ part: 'products', error: e.message });
  } finally {
    closeBrowser().catch(() => {});
  }`;
const neu = `  let products = [];
  try {
    const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
    const scraped = await Promise.race([
      scrapeProducts(queries),
      new Promise((_, rej) => setTimeout(() => rej(new Error('商品抓取超时（120s）')), 120000)),
    ]);
    products = scraped.items || [];
    errors.push(...(scraped.errors || []));
  } catch (e) {
    errors.push({ part: 'products', error: e.message });
  }`;
if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, neu);
writeFileSync(p, c, 'utf8');
console.log('products step guarded with timeout');
