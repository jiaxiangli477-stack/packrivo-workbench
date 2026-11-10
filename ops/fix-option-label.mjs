import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const old = "'<option ' + (map[k] === m ? 'selected' : '') + '>' + esc(m) + '</option>'";
const neu = "'<option value=\"' + esc(m) + '\" ' + (map[k] === m ? 'selected' : '') + '>' + esc(String(m).replace(/\\s*·.*$/, '')) + '</option>'";
if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, neu);
writeFileSync(p, c, 'utf8');
console.log('option label cleaned');
