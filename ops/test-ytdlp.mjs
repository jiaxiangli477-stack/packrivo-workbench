import { discover, youtubeExtractor } from '../app/sources.mjs';
console.log('extractor:', youtubeExtractor());
const t0 = Date.now();
const r = await discover({ keywords: ['custom mailer box', 'kraft packaging supplier'], sources: ['youtube'], per: 4 });
console.log('elapsed', ((Date.now()-t0)/1000).toFixed(1)+'s', 'items', r.items.length, 'errors', JSON.stringify(r.errors));
for (const it of r.items) console.log([it.score, it.stats.views, it.published, it.days+'d', it.author.slice(0,18), it.title.slice(0,50)].join(' | '));