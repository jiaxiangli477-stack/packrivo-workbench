import { amazonSearch, closeBrowser } from '../app/browser.mjs';
const items = await amazonSearch('jewelry gift box', 6);
for (const x of items) console.log(x.price, '|', '★' + x.rating, '|', x.reviews || '-', '|', x.bought || '-', '|', x.url.slice(0, 55));
await closeBrowser();
process.exit(0);
