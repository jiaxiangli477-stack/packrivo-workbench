const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'en-US,en;q=0.9', accept: 'text/html' };
for (const [name, url] of [['bing','https://www.bing.com/search?q=packaging+trends+2026&setlang=en'], ['ddg-lite','https://lite.duckduckgo.com/lite/?q=packaging+trends'], ['brave','https://search.brave.com/search?q=packaging+trends']]) {
  try {
    const r = await fetch(url, { headers });
    const t = await r.text();
    const titles = [...t.matchAll(/<h2[^>]*>\s*<a[^>]*>([^<]{5,100})</g)].slice(0,3).map(m=>m[1]);
    console.log(name, r.status, 'len', t.length, 'titles', JSON.stringify(titles));
  } catch (e) { console.log(name, 'ERR', e.message); }
}