const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
async function probe(sp, label) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent('custom jewelry boxes')}&sp=${sp}`;
  const html = await (await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } })).text();
  const dates = [...html.matchAll(/"publishedTimeText":\{"simpleText":"([^"]+)"/g)].map(m => m[1]).slice(0, 8);
  const ids = [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map(m => m[1]);
  console.log(label, 'ids', new Set(ids).size, 'dates:', dates.join(' | '));
}
await probe('CAI%253D', 'sort-by-date');
await probe('EgQIBRAB', 'this-year');
await probe('', 'default');