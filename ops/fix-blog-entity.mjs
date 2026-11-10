import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const oldStrip = "  const strip = (x) => String(x || '').replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/<style[\\s\\S]*?<\\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();";
const newStrip = [
  "  const ENT = { amp: '&', lt: '<', gt: '>', quot: '\"', apos: \"'\", nbsp: ' ', ndash: '-', mdash: '--', rsquo: \"'\", lsquo: \"'\", ldquo: '\"', rdquo: '\"', hellip: '...' };",
  "  const decodeEnt = (t) => String(t || '')",
  "    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))",
  "    .replace(/&#(\\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))",
  "    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));",
  "  const strip = (x) => decodeEnt(String(x || '').replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/<style[\\s\\S]*?<\\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim());",
].join('\n');
if (c.includes(oldStrip)) {
  c = c.replace(oldStrip, newStrip);
  writeFileSync(p, c, 'utf8');
  console.log('blog entity decode added');
} else {
  console.log('anchor missing');
}
