import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const bad = "  const stage = (s) => { try { onStage && onStage(s); } catch {} }; {";
const good = "  const stage = (s) => { try { onStage && onStage(s); } catch {} };";
if (!c.includes(bad)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(bad, () => good);
writeFileSync(p, c, 'utf8');
console.log('fixed extra brace');