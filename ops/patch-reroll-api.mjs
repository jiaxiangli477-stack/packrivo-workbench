import { readFileSync, writeFileSync } from 'node:fs';

const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!s.includes(a)) { miss.push(n); return; } s = s.replace(a, b); done.push(n); };

rep('import-buildItems',
  "import { buildRadar, probeCompetitor, suggest } from './radar.mjs';",
  "import { buildRadar, buildItems, probeCompetitor, suggest } from './radar.mjs';");

/* 刷新后把条目记入 seen */
rep('mark-seen',
  `  run('insert into radar_snapshot(id, payload, fetched_at) values (1, ?, ?) on conflict(id) do update set payload = excluded.payload, fetched_at = excluded.fetched_at',
    JSON.stringify(radar), radar.generated_at);`,
  `  run('insert into radar_snapshot(id, payload, fetched_at) values (1, ?, ?) on conflict(id) do update set payload = excluded.payload, fetched_at = excluded.fetched_at',
    JSON.stringify(radar), radar.generated_at);
  for (const it of [...(radar.videos || []), ...(radar.posts || []), ...(radar.articles || [])]) {
    if (it && it.url) run('insert or ignore into radar_seen(url) values (?)', it.url);
  }`);

/* 换一批 */
rep('reroll-route',
  `on('POST', /^\\/api\\/radar\\/suggest$/, async (m, b) => {`,
  `on('POST', /^\\/api\\/radar\\/reroll$/, async (m, b) => {
  const scope = ['videos', 'posts', 'articles'].includes(b.scope) ? b.scope : 'videos';
  const row = get('select * from radar_snapshot where id = 1');
  if (!row) throw new Error('还没有情报快照，先点「刷新情报」');
  let snap;
  try { snap = JSON.parse(row.payload); } catch { throw new Error('快照损坏，请重新刷新'); }
  const exclude = new Set(all('select url from radar_seen').map((r) => r.url));
  const seeds = (snap.seeds && snap.seeds.length ? snap.seeds : [snap.category]).filter(Boolean);
  const batch = await buildItems({ category: snap.category, seeds, exclude, per: 8 });
  const fresh = batch[scope] || [];
  const usedFallback = fresh.length === 0;
  if (!usedFallback) snap[scope] = fresh;
  snap.batch = (snap.batch || 0) + 1;
  snap.reroll_at = nowIso();
  run('update radar_snapshot set payload = ? where id = 1', JSON.stringify(snap));
  for (const it of fresh) if (it.url) run('insert or ignore into radar_seen(url) values (?)', it.url);
  audit('radar.reroll', scope, { count: fresh.length, fallback: usedFallback });
  return { ok: true, scope, count: fresh.length, fallback: usedFallback, errors: batch.errors };
});

on('POST', /^\\/api\\/radar\\/suggest$/, async (m, b) => {`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
