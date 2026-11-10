import { buildRadar } from '../app/radar.mjs';

const t0 = Date.now();
const out = await buildRadar({
  category: 'jewelry, candle & gift packaging',
  keywords: ['custom packaging', 'jewelry box', 'candle box', 'gift box'],
  competitors: [],
  market: 'us',
  videosPer: 4,
});

const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log('耗时 %ss', dt);
for (const k of ['keywords', 'videos', 'posts', 'articles', 'products', 'competitors']) {
  const v = out[k];
  console.log(`${k}: ${Array.isArray(v) ? v.length : typeof v}`);
}
console.log('audit:', JSON.stringify(out.audit || {}).slice(0, 300));
console.log('errors:', JSON.stringify(out.errors || []).slice(0, 600));
console.log('videos 样例:', JSON.stringify((out.videos || []).slice(0, 2)).slice(0, 400));
