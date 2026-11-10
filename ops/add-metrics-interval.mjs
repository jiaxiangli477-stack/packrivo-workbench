import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
if (!c.includes('sync-bsky', ) || !c.includes('setInterval(syncTick')) {
  // 在 server.listen 之前挂一个 30 分钟同步
  const anchor = 'server.listen(PORT, HOST, () => {';
  const add = `/* 每 30 分钟回捞一次 Bluesky 互动数据 */
setInterval(() => {
  fetch(\`http://127.0.0.1:\${PORT}/api/metrics/sync-bsky\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .catch(() => {});
}, 30 * 60 * 1000);

server.listen(PORT, HOST, () => {`;
  if (!c.includes(anchor)) { console.log('MISS listen anchor'); process.exit(1); }
  c = c.replace(anchor, () => add);
  writeFileSync(p, c, 'utf8');
  console.log('30min metrics sync scheduled');
}