const uri = 'at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/3myqqu63jbg2a';
const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then((r) => r.json());
const p = (j.posts || [])[0];
console.log(p ? '帖子存在' : 'NOT FOUND');
console.log('---该帖 完整正文---');
console.log(p.record.text);
console.log('---');
console.log('配图:', p.embed?.$type, '| alt:', p.embed?.images?.[0]?.alt);
console.log('URL: https://bsky.app/profile/' + p.author.handle + '/post/' + p.uri.split('/').pop());