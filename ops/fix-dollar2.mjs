import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const before = (c.match(/\$\$\('/g) || []).length;
c = c.split("$('[data-imgprompt]')").join("$$" + "('[data-imgprompt]')");
writeFileSync(p, c, 'utf8');
console.log('$$ before', before, 'after', (c.match(/\$\$\('/g) || []).length);