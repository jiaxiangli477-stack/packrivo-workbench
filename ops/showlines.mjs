import { readFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const lines = readFileSync(p, 'utf8').split(/\r?\n/);
lines.forEach((l, i) => {
  if (l.includes("radar/refresh")) {
    console.log('line', i + 1);
    for (let k = i - 2; k <= i + 2; k++) console.log(JSON.stringify(lines[k]));
  }
});