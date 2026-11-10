import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
c = c.split("$('[data-ai]')").join("$$" + "('[data-ai]')");
writeFileSync(p, c, 'utf8');
console.log('fixed data-ai:', c.includes("$$('[data-ai]')"));