import { searchMastodon, searchLemmy } from '../app/radar.mjs';
const m = await searchMastodon('packaging', 3);
const l = await searchLemmy('custom packaging', 3);
console.log('mastodon', m.length);
m.forEach(x => console.log(' ', x.score, x.author, '|', x.title.slice(0,50), '| thumb:', !!x.thumb, '| fav', x.stats.fav));
console.log('lemmy', l.length);
l.forEach(x => console.log(' ', x.score, x.author, '|', x.title.slice(0,50), '| thumb:', !!x.thumb, '| score', x.stats.score));