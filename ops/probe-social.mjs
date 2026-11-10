const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', accept: 'application/json' };
async function probe(name, url) {
  try {
    const r = await fetch(url, { headers: H });
    const t = await r.text();
    console.log('===', name, r.status, 'len', t.length);
    console.log(t.slice(0, 260).replace(/\s+/g, ' '));
  } catch (e) { console.log('===', name, 'ERR', e.message); }
}
await probe('mastodon-tag', 'https://mastodon.social/api/v1/timelines/tag/packaging?limit=3');
await probe('lemmy-search', 'https://lemmy.world/api/v3/search?q=packaging&type_=Posts&sort=TopAll&limit=3');
await probe('bsky-retry', 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=packaging&limit=2');
await probe('hn', 'https://hn.algolia.com/api/v1/search?query=packaging&tags=story&hitsPerPage=2');