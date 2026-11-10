import { searchBluesky, searchMastodon } from '../app/radar.mjs';
const qs = ['jewelry box packaging','candle packaging','gift box packaging','jewelry packaging','candle box','unboxing jewelry','custom packaging','packaging design'];
const seen = new Set(); const all = [];
for (const q of qs) {
  try {
    const items = await searchBluesky(q, 12);
    for (const it of items) {
      const eng = (it.stats.fav||0)+(it.stats.boost||0)+(it.stats.reply||0);
      if (eng >= 2 && !seen.has(it.url)) { seen.add(it.url); all.push({ q, eng, t: it.title.slice(0,60) }); }
    }
  } catch (e) { console.log('ERR', q, e.message); }
}
console.log('bluesky candidates (eng>=2):', all.length);
all.slice(0,12).forEach(x => console.log(' ', x.eng, '|', x.t));