import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const old = '  const siteList = [...new Set(competitors)].slice(0, 24);';
const neu = `  let products = [];
  try {
    const queries = [seeds[0] || 'custom jewelry box', 'candle packaging box'].filter(Boolean);
    const scraped = await scrapeProducts(queries);
    products = scraped.items || [];
    errors.push(...(scraped.errors || []));
  } catch (e) {
    errors.push({ part: 'products', error: e.message });
  } finally {
    closeBrowser().catch(() => {});
  }

  const siteList = [...new Set(competitors)].slice(0, 24);`;
if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, neu);
writeFileSync(p, c, 'utf8');
console.log('products scrape inserted');
