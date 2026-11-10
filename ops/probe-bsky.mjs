const UA='Mozilla/5.0';
const r = await fetch('https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=packaging&limit=3&sort=top',{headers:{'user-agent':UA,accept:'application/json'}});
const j = await r.json();
console.log('status', r.status, 'posts', j.posts?.length);
for (const p of (j.posts||[]).slice(0,3)) {
  const rec = p.record||{};
  const img = p.embed?.images?.[0] || p.embed?.media?.images?.[0];
  console.log('-', p.author?.handle, '| likes', p.likeCount, 'reposts', p.repostCount, 'replies', p.replyCount);
  console.log('  text:', String(rec.text||'').slice(0,80).replace(/\s+/g,' '));
  console.log('  img:', img ? (img.thumb || img.fullsize) : 'none');
  console.log('  uri:', p.uri);
}