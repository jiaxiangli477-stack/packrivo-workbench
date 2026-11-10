import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
for (const sel of ['data-rewrite','data-ok']) {
  const bad = "$('[" + sel + "]')";
  const good = "$$('[" + sel + "]')";
  if (c.includes(bad)) { c = c.split(bad).join(good); console.log('fixed', sel); }
}
writeFileSync(p, c, 'utf8');