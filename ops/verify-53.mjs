const url = 'https://bsky.app/profile/packrivo.bsky.social/post/3myrkkfcnvj2p';
const rkey = url.split('/').pop();
const uri = 'at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/' + rkey;
const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then(r => r.json());
const p = (j.posts || [])[0];
if (!p) { console.log('NOT FOUND'); process.exit(1); }
console.log('正文(' + p.record.text.length + '字):');
console.log(p.record.text);
console.log('---');
console.log('embed:', p.embed?.$type, '| 卡片标题:', p.embed?.external?.title || '(无)');