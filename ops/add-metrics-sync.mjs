import { readFileSync, writeFileSync } from 'node:fs';

const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

/* 1) 结果查询带上正文与配图 */
rep('results-join',
  "  results: all('select r.*, c.title, c.platform from publish_result r left join content c on c.id = r.content_id order by r.id desc limit 200'),",
  "  results: all('select r.*, c.title, c.body, c.image_path, c.hashtags, c.platform from publish_result r left join content c on c.id = r.content_id order by r.id desc limit 200'),");

/* 2) Bluesky 互动回捞 */
if (!s.includes('/api/metrics/sync-bsky')) {
  s = s.replace(
    '/* ---------- 固定工作流：每一步的实时状态 ---------- */',
    `/* ---------- 已发 Bluesky 帖的互动回捞 ---------- */
on('POST', /^\\/api\\/metrics\\/sync-bsky$/, async (m, b) => {
  const rows = all(\`select r.id, r.content_id, r.url, c.platform
                     from publish_result r join content c on c.id = r.content_id
                     where r.ok = 1 and r.url like 'https://bsky.app/%'\`);
  const byContent = new Map();
  for (const r of rows) {
    const rkey = String(r.url).split('/').pop();
    if (rkey) byContent.set(r.content_id, rkey);
  }
  if (!byContent.size) return { ok: true, updated: 0, reason: '没有已发的 Bluesky 帖' };

  /* 先拿 did：通过任意一条帖子解析 */
  const firstRkey = [...byContent.values()][0];
  const probe = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' +
    encodeURIComponent('at://did:plc:kc2iyknmca5jqz3pxv2mqfgx/app.bsky.feed.post/' + firstRkey)).then((r) => r.json()).catch(() => null);
  const did = probe?.posts?.[0]?.author?.did;
  if (!did) return { ok: false, error: '解析作者 DID 失败' };

  const uris = [...byContent.values()].map((k) => 'at://' + did + '/app.bsky.feed.post/' + k);
  const updated = [];
  for (let i = 0; i < uris.length; i += 25) {
    const chunk = uris.slice(i, i + 25);
    const q = chunk.map((u) => 'uris=' + encodeURIComponent(u)).join('&');
    const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?' + q).then((r) => r.json()).catch(() => null);
    for (const p of (j?.posts || [])) {
      const rkey = String(p.uri).split('/').pop();
      const contentId = [...byContent.entries()].find(([, k]) => k === rkey)?.[0];
      if (!contentId) continue;
      const day = new Date().toISOString().slice(0, 10);
      run(\`insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, inquiries, source)
           values (?,?,?,?,?,?,?,0,0,0,0,0,'bluesky_api')
           on conflict(content_id, day) do update set
             likes=excluded.likes, comments=excluded.comments, shares=excluded.shares, source='bluesky_api'\`,
        contentId, 'bluesky', day, p.likeCount + p.repostCount + p.replyCount, p.likeCount, p.replyCount, p.repostCount);
      updated.push({ content_id: contentId, likes: p.likeCount, reposts: p.repostCount, replies: p.replyCount });
    }
  }
  audit('metrics.sync_bsky', 'all', { count: updated.length });
  return { ok: true, updated: updated.length, rows: updated };
});

/* ---------- 固定工作流：每一步的实时状态 ---------- */`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: metrics sync added');
}
console.log('done:', done.join(', '));
