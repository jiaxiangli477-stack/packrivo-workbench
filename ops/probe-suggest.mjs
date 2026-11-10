const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };
async function j(name, url) {
  try {
    const r = await fetch(url, { headers: H });
    const t = await r.text();
    console.log('===', name, r.status, 'len', t.length);
    console.log(t.slice(0, 400).replace(/\s+/g, ' '));
  } catch (e) { console.log('===', name, 'ERR', e.message); }
}
await j('google-suggest', 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=custom%20packaging');
await j('bsky-search', 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=packaging&limit=3');