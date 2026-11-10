import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const old = `  const [w, h] = ratio.split(':').map(Number);
  const base = 1024;
  const width = w && h ? Math.round(base * (w / Math.max(w, h))) : 832;
  const height = w && h ? Math.round(base * (h / Math.max(w, h))) : 1024;`;
const neu = `  const [w, h] = ratio.split(':').map(Number);
  const base = 1024;
  const snap = (v) => Math.max(512, Math.round(v / 64) * 64);   // SD 要求 8 的倍数，取 64 对齐
  const width = w && h ? snap(base * (w / Math.max(w, h))) : 832;
  const height = w && h ? snap(base * (h / Math.max(w, h))) : 1024;`;
let n = 0;
while (c.includes(old)) { c = c.replace(old, () => neu); n++; }
writeFileSync(p, c, 'utf8');
console.log('snapped width/height in', n, 'places');