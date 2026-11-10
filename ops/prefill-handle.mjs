import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const old = ').map(([f, label, ph]) => `<div class="field" style="flex:1"><label>${label}</label><input id="cf-${a.id}-${f}" placeholder="${ph}" /></div>`).join(\'\')}';
const neu = ').map(([f, label, ph]) => `<div class="field" style="flex:1"><label>${label}</label><input id="cf-${a.id}-${f}" placeholder="${ph}" value="${f === \'handle\' && a.handle ? String(a.handle).replace(/^@/, \'\') : \'\'}" /></div>`).join(\'\')}';
if (!c.includes(old)) { console.log('prefill anchor missing'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('handle prefill added');