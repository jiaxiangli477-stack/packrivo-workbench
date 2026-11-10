import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const BASE = 'http://127.0.0.1:8795';
const MEDIA = 'E:/破甲工作区/social-workbench/data/media/';

const posts = [
  {
    body: `Three rigid jewelry box builds, three jobs:
- drawer: the reveal
- magnetic: shelf presence
- lid & base: cheapest rigid

Choose by how the box opens, not by unit price.`,
    url: 'https://www.packrivo.com/product-magnetic-jewelry-box/?utm_source=bluesky',
    tag: '#JewelryPackaging',
    image: MEDIA + 'bsky-magnetic-01.jpg',
    alt: 'Green rigid magnetic jewelry box, lid open showing a fitted insert with a ring and earrings',
    when: 'now',
  },
  {
    body: `Inserts are where samples fail.
Send: product outline (with clasp), contact points, and how a buyer lifts it out.
Molded pulp vs die-cut foam vs hand-glued tray changes tooling and MOQ — decide before sampling.`,
    url: 'https://www.packrivo.com/product-jewelry-box-with-insert/?utm_source=bluesky',
    tag: '#PackagingDesign',
    image: MEDIA + 'bsky-insert-01.jpg',
    alt: 'Jewelry box insert layout: molded pulp and die-cut tray holding rings, necklace and earrings',
    when: 'now',
  },
  {
    body: `What to send for a packaging quote that's actually comparable:
1 outline + how it's packed
2 quantity per design
3 destination country
4 sample deadline

Miss one and the quotes aren't comparable.`,
    url: 'https://www.packrivo.com/product-lid-and-base-jewelry-box/?utm_source=bluesky',
    tag: '#SourcingTips',
    image: MEDIA + 'bsky-lidbase-01.jpg',
    alt: 'Lid and base jewelry box in green with a fitted insert holding a necklace and earrings',
    when: 'tomorrow',
  },
];

const made = [];
for (const p of posts) {
  const full = p.body + '\n\n' + p.url + '\n\n' + p.tag;
  if (full.length > 300) { console.log('超长跳过:', full.length, p.tag); continue; }
  const c = await fetch(BASE + '/api/contents', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ platform: 'bluesky', title: '', body: p.body, hashtags: p.tag }),
  }).then((r) => r.json());
  db.prepare("update content set utm_url=?, image_path=?, image_alt=?, status='approved' where id=?")
    .run(p.url, p.image, p.alt, c.id);
  made.push({ id: c.id, when: p.when, chars: full.length });
  console.log('#', c.id, p.when, 'chars', full.length);
}

/* 前两条立刻发，第三条排到明早 09:00 */
for (const m of made) {
  const runAt = m.when === 'tomorrow'
    ? new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10) + ' 09:00:00'
    : undefined;
  const sched = await fetch(BASE + '/api/schedules', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content_id: m.id, account_id: 4, channel: 'bluesky', ...(runAt ? { run_at: runAt } : {}) }),
  }).then((r) => r.json());
  console.log('schedule', sched.id, 'content', m.id, 'run_at', sched.run_at);
}

/* 立刻跑队列（只会发已到点的） */
for (let i = 0; i < 3; i++) {
  await fetch(BASE + '/api/tick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  await new Promise((r) => setTimeout(r, 1200));
}

const rows = db.prepare("select id, content_id, channel, ok, url, error_class, detail from publish_result where id > 7 order by id").all();
console.log('--- 发布结果 ---');
for (const r of rows) console.log(JSON.stringify(r));
