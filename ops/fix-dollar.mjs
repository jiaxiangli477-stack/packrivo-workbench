import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const before = (c.match(/\$\$\('/g) || []).length;
c = c.split("$('[data-goto]')").join("$$" + "('[data-goto]')");
c = c.split("$('[data-reroll]')").join("$$" + "('[data-reroll]')");
writeFileSync(p, c, 'utf8');
console.log('$$ count', before, '->', (c.match(/\$\$\('/g) || []).length);
console.log('goto fixed:', c.includes("$$('[data-goto]')"), 'reroll fixed:', c.includes("$$('[data-reroll]')"));