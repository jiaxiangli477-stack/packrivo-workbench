const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
async function probe(name, url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    const t = await r.text();
    console.log('===', name, r.status, 'len', t.length);
    console.log(t.slice(0, 180).replace(/\s+/g, ' '));
  } catch (e) { console.log('===', name, 'ERR', e.message); }
}
await probe('pixelfed.de', 'https://pixelfed.de/api/v1/timelines/tag/packaging?limit=3');
await probe('pixelfed.social-public', 'https://pixelfed.social/api/v1/timelines/public?limit=3');
await probe('bsky-api', 'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=packaging&limit=2');
await probe('bsky-public', 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=packaging&limit=2');