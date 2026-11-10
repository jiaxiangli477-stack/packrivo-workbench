import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const bad = "$('[data-exp-sch]')";
const good = "$$" + "('[data-exp-sch]')";
if (c.includes(bad)) { c = c.split(bad).join(good); console.log('fixed exp-sch'); }
writeFileSync(p, c, 'utf8');