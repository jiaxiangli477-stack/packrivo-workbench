import { discover } from '../app/sources.mjs';
const r = await discover({ keywords: ['custom mailer box', 'packaging trends'], sources: ['youtube', 'gnews'], per: 4 });
console.log('items', r.items.length, 'errors', JSON.stringify(r.errors));
for (const it of r.items) {
  console.log([it.source, it.kind, it.score, it.score_type, (it.stats.views ?? '') + 'v', it.days + 'd', it.title.slice(0, 55)].join(' | '));
}