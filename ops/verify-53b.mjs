const uri = 'at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/3myrkkfcnvj2p';
const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then(r => r.json());
const p = (j.posts || [])[0];
console.log('卡片缩略图:', p.embed?.external?.thumb ? 'yes' : 'no');
console.log('卡片链接:', p.embed?.external?.uri);