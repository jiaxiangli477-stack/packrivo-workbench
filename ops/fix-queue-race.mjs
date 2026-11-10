import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/queue.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

/* 原子领取排期：先改状态再建 job，避免并发 tick 重复发布 */
rep('claim-schedule',
`    const payload = { schedule_id: s.id };
    run("insert into job(kind, payload, state, run_at) values ('publish', ?, 'queued', ?)", JSON.stringify(payload), now);
    run("update schedule set state = 'queued' where id = ?", s.id);`,
`    const claimed = run("update schedule set state = 'queued' where id = ? and state = 'pending'", s.id);
    if (!claimed || !claimed.changes) continue;   // 别人已经领走了
    const payload = { schedule_id: s.id };
    run("insert into job(kind, payload, state, run_at) values ('publish', ?, 'queued', ?)", JSON.stringify(payload), now);`);

/* 原子领取 job */
rep('claim-job',
`async function runJob(job) {
  const payload = JSON.parse(job.payload || '{}');`,
`async function runJob(job) {
  const grabbed = run("update job set state = 'running' where id = ? and state in ('queued','retry')", job.id);
  if (!grabbed || !grabbed.changes) return;   // 另一个 worker 已经拿走
  const payload = JSON.parse(job.payload || '{}');`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
