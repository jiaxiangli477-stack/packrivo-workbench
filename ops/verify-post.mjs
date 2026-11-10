const uri = 'at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/3myqqmli2cm2z';
const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then((r) => r.json());
const p = (j.posts || [])[0];
if (!p) { console.log('NOT FOUND'); process.exit(1); }
console.log('作者:', p.author.handle);
console.log('正文:', p.record.text);
console.log('配图类型:', p.embed?.$type);
console.log('alt:', p.embed?.images?.[0]?.alt);
console.log('时间:', p.record.createdAt);
console.log('赞/转:', p.likeCount, '/', p.repostCount);
console.log('URL: https://bsky.app/profile/' + p.author.handle + '/post/' + p.uri.split('/').pop());
