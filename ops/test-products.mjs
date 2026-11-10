import { scrapeProducts, closeBrowser } from '../app/browser.mjs';
const t0 = Date.now();
const r = await scrapeProducts(['jewelry gift box', 'candle packaging box']);
console.log('ms', Date.now() - t0, 'items', r.items.length, 'errors', JSON.stringify(r.errors).slice(0, 300));
for (const x of r.items.slice(0, 8)) console.log(x.source, '|', (x.price || x.moq || ''), '|', x.rating || '', x.reviews || '', '|', x.title.slice(0, 60));
await closeBrowser();
