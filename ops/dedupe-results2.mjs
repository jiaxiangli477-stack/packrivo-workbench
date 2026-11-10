import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const raw = readFileSync(p, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(eol);
const start = 955 - 1;
if (!lines[start].includes('async function viewResults')) { console.log('start mismatch:', JSON.stringify(lines[start])); process.exit(1); }
let end = -1;
for (let i = start + 1; i < start + 80; i++) {
  if (lines[i].trim() === '}') { end = i; break; }
}
if (end < 0) { console.log('end not found'); process.exit(1); }
console.log('removing lines', start + 1, 'to', end + 1, 'eol=', JSON.stringify(eol));
lines.splice(start, end - start + 1);
writeFileSync(p, lines.join(eol), 'utf8');