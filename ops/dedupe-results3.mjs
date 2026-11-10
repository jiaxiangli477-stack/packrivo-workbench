import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const raw = readFileSync(p, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(eol);
const hits = [];
lines.forEach((l, i) => { if (l.startsWith('async function viewResults')) hits.push(i); });
console.log('hits:', hits.map((i) => i + 1));
if (hits.length < 2) { console.log('no duplicate'); process.exit(0); }
const start = hits[1];
let end = -1;
for (let i = start + 1; i < start + 80; i++) {
  if (lines[i].trim() === '}') { end = i; break; }
}
if (end < 0) { console.log('end not found'); process.exit(1); }
console.log('removing', start + 1, '-', end + 1);
lines.splice(start, end - start + 1);
writeFileSync(p, lines.join(eol), 'utf8');
console.log('remaining definitions:', (lines.join('\n').match(/async function viewResults/g) || []).length);