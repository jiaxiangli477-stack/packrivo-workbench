import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const lines = readFileSync(p, 'utf8').split('\n');
// 删除第二份 viewResults（第 955 行起，到 980 行的 } 结束）
const start = 955 - 1;
if (!lines[start].includes('async function viewResults')) { console.log('start mismatch:', lines[start]); process.exit(1); }
let end = -1;
for (let i = start + 1; i < start + 60; i++) {
  if (lines[i] === '}') { end = i; break; }
}
if (end < 0) { console.log('end not found'); process.exit(1); }
console.log('removing lines', start + 1, 'to', end + 1);
lines.splice(start, end - start + 1);
writeFileSync(p, lines.join('\n'), 'utf8');