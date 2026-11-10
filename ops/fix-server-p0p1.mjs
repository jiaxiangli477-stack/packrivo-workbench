import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- db: metric.inquiries ---------- */
const dp = 'E:/破甲工作区/social-workbench/app/db.mjs';
let d = readFileSync(dp, 'utf8');
if (!d.includes('inquiries')) {
  d = d.replace(
    "  orders_amount real not null default 0,",
    "  orders_amount real not null default 0,\n  inquiries integer not null default 0,"
  );
  d = d.replace(
    "/* 老库补列：metric.source / hotspot 的发现字段 */",
    "/* 老库补列：metric.inquiries */\n{\n  const cols = db.prepare('PRAGMA table_info(metric)').all().map((c) => c.name);\n  if (!cols.includes('inquiries')) db.exec('alter table metric add column inquiries integer not null default 0');\n}\n\n/* 老库补列：metric.source / hotspot 的发现字段 */"
  );
  writeFileSync(dp, d, 'utf8');
  console.log('db: inquiries added');
}

/* ---------- server ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!s.includes(a)) { miss.push(n); return; } s = s.replace(a, b); done.push(n); };

/* 1) 落地页可达性检查 */
rep('reachable-helper',
  "/* ---------- 品牌知识库 ---------- */",
  `/* 落地页可达性检查：保存产品前先探一次，打不开就不让保存 */
async function assertReachable(url) {
  if (!url) return;
  const tryFetch = async (method) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      return await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
    } finally { clearTimeout(t); }
  };
  let r;
  try { r = await tryFetch('HEAD'); } catch {}
  if (!r || !r.ok) {
    try { r = await tryFetch('GET'); } catch {}
  }
  if (!r || !r.ok) throw new Error('落地页打不开' + (r ? '（HTTP ' + r.status + '）' : '') + '：' + url);
}

/* ---------- 品牌知识库 ---------- */`);

rep('product-url-check-post',
  `on('POST', /^\\/api\\/products$/, async (m, b) => {
  if (!b.sku || !b.name) throw new Error('sku 与 name 必填');`,
  `on('POST', /^\\/api\\/products$/, async (m, b) => {
  if (!b.sku || !b.name) throw new Error('sku 与 name 必填');
  if (b.url) await assertReachable(b.url);`);

rep('product-url-check-patch',
  `on('PATCH', /^\\/api\\/products\\/(\\d+)$/, async (m, b) => {
  const id = Number(m[1]);`,
  `on('PATCH', /^\\/api\\/products\\/(\\d+)$/, async (m, b) => {
  const id = Number(m[1]);
  if (b.url) await assertReachable(b.url);`);

/* 2) 总览：mock 单独统计 + 示例数据标记 */
rep('overview-counts',
  `    published: get("select count(*) c from publish_result where ok = 1").c,
    failed: get("select count(*) c from publish_result where ok = 0").c,`,
  `    published: get("select count(*) c from publish_result where ok = 1 and channel <> 'mock'").c,
    published_test: get("select count(*) c from publish_result where ok = 1 and channel = 'mock'").c,
    failed: get("select count(*) c from publish_result where ok = 0").c,
    demoMetrics: get("select count(*) c from metric where source = 'demo'").c,`);

/* 3) 询盘字段 */
rep('metric-post-inquiries',
  `    cid, b.platform || c.platform, day, num(b.impressions), num(b.likes), num(b.comments), num(b.shares),
    num(b.saves), num(b.clicks), num(b.sessions), Number(b.orders_amount) || 0, b.source || 'manual'`,
  `    cid, b.platform || c.platform, day, num(b.impressions), num(b.likes), num(b.comments), num(b.shares),
    num(b.saves), num(b.clicks), num(b.sessions), Number(b.orders_amount) || 0, b.source || 'manual'`);

rep('metric-upsert-cols',
  `    \`insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, source)
     values (?,?,?,?,?,?,?,?,?,?,?,?)\``,
  `    \`insert into metric(content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, inquiries, source)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?)\``);

rep('metric-upsert-vals',
  `    num(b.saves), num(b.clicks), num(b.sessions), Number(b.orders_amount) || 0, b.source || 'manual'
  );`,
  `    num(b.saves), num(b.clicks), num(b.sessions), Number(b.orders_amount) || 0, num(b.inquiries), b.source || 'manual'
  );`);

rep('metric-upsert-set',
  `       saves=excluded.saves, clicks=excluded.clicks, sessions=excluded.sessions, orders_amount=excluded.orders_amount,`,
  `       saves=excluded.saves, clicks=excluded.clicks, sessions=excluded.sessions, orders_amount=excluded.orders_amount, inquiries=excluded.inquiries,`);

/* 4) 聚合里加询盘 */
rep('agg-init',
  `  const t = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, sessions: 0, orders_amount: 0, posts: new Set() };`,
  `  const t = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, sessions: 0, orders_amount: 0, inquiries: 0, posts: new Set() };`);

rep('agg-sum',
  `    t.orders_amount += r.orders_amount || 0;`,
  `    t.orders_amount += r.orders_amount || 0;\n    t.inquiries += r.inquiries || 0;`);

rep('agg-out',
  `    clicks: t.clicks, sessions: t.sessions, orders_amount: Math.round(t.orders_amount * 100) / 100,`,
  `    clicks: t.clicks, sessions: t.sessions, orders_amount: Math.round(t.orders_amount * 100) / 100, inquiries: t.inquiries,`);

rep('plat-agg',
  `    const cur = platMap.get(p) || { platform: p, impressions: 0, engagements: 0, clicks: 0, sessions: 0, posts: new Set() };`,
  `    const cur = platMap.get(p) || { platform: p, impressions: 0, engagements: 0, clicks: 0, sessions: 0, inquiries: 0, posts: new Set() };`);

rep('plat-agg-sum',
  `    cur.sessions += r.sessions || 0;\n    if (r.content_id) cur.posts.add(r.content_id);`,
  `    cur.sessions += r.sessions || 0;\n    cur.inquiries += r.inquiries || 0;\n    if (r.content_id) cur.posts.add(r.content_id);`);

rep('post-agg',
  `      const c = postMap.get(k) || { content_id: k, platform: p, title: r.title || '', impressions: 0, engagements: 0, clicks: 0, sessions: 0, orders_amount: 0 };`,
  `      const c = postMap.get(k) || { content_id: k, platform: p, title: r.title || '', impressions: 0, engagements: 0, clicks: 0, sessions: 0, orders_amount: 0, inquiries: 0 };`);

rep('post-agg-sum',
  `      c.orders_amount += r.orders_amount || 0;`,
  `      c.orders_amount += r.orders_amount || 0;\n      c.inquiries += r.inquiries || 0;`);

/* 5) UTM 按产品命名 */
rep('utm-naming',
  `    const utm = \`\${utmBase}\${utmBase.includes('?') ? '&' : '?'}utm_source=\${platform}&utm_medium=social&utm_campaign=bench\`;`,
  `    const slug = String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || product.sku.toLowerCase();
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const utm = \`\${utmBase}\${utmBase.includes('?') ? '&' : '?'}utm_source=\${platform}&utm_medium=social&utm_campaign=\${slug}-\${yymm}\`;`);

writeFileSync(sp, s, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
