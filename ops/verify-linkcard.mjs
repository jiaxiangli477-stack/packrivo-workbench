const uri = 'at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/3myqsksdcn22a';
const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri)).then(r => r.json());
const p = (j.posts||[])[0];
console.log('正文长度:', p.record.text.length, '/300');
console.log(p.record.text);
console.log('---');
console.log('embed:', p.embed?.$type);
if (p.embed?.external) {
  const e = p.embed.external;
  console.log('卡片标题:', e.title);
  console.log('卡片链接:', e.uri);
  console.log('缩略图:', e.thumb ? 'yes' : 'no');
  console.log('描述:', (e.description||'').slice(0,80));
}