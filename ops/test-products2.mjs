import { scrapeProducts, closeBrowser } from '../app/browser.mjs';
const r = await scrapeProducts(['jewelry gift box']);
const by = {};
for (const x of r.items) by[x.source] = (by[x.source] || 0) + 1;
console.log('items', r.items.length, 'by source', JSON.stringify(by), 'errors', r.errors.length);
for (const x of r.items.slice(0, 3)) console.log(x.source, '|', x.price || x.moq, '|', x.title.slice(0, 60), '|', (x.thumb || '').slice(0, 50));
await closeBrowser();
process.exit(0);
