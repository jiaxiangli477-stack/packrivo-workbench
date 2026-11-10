const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'en-US,en;q=0.9' };
async function probe(name, url, pick) {
  try {
    const r = await fetch(url, { headers: ua });
    const t = await r.text();
    console.log(name, 'status', r.status, 'len', t.length, '|', pick(t).slice(0, 160).replace(/\s+/g, ' '));
  } catch (e) { console.log(name, 'ERR', e.message); }
}
await probe('old.reddit', 'https://old.reddit.com/search.json?q=custom%20mailer%20box&limit=3', (t) => {
  try { const j = JSON.parse(t); return j.data.children.map(c => c.data.title + ' | ups=' + c.data.ups).join(' ;; '); } catch { return t.slice(0, 80); }
});
await probe('reddit-api', 'https://api.reddit.com/search?q=custom%20mailer%20box&limit=3', (t) => {
  try { const j = JSON.parse(t); return j.data.children.map(c => c.data.title + ' | ups=' + c.data.ups).join(' ;; '); } catch { return t.slice(0, 80); }
});
await probe('youtube', 'https://www.youtube.com/results?search_query=custom+mailer+box&sp=CAMSAhAB', (t) => {
  const m = t.match(/"viewCountText":\{"simpleText":"([^"]+)"/);
  const title = t.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
  return 'title=' + (title ? title[1] : '?') + ' views=' + (m ? m[1] : '?');
});
await probe('ddg-html', 'https://html.duckduckgo.com/html/?q=packaging+trends+2026', (t) => {
  const m = [...t.matchAll(/result__a[^>]*>([^<]{5,90})</g)].slice(0, 3).map(x => x[1]);
  return 'titles=' + JSON.stringify(m);
});