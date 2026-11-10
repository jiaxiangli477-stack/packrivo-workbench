import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const anchor = "  $$('[data-exp]').forEach((b) => (b.onclick = () => {";
if (!c.includes(anchor)) { console.log('MISS'); process.exit(1); }
if (!c.includes('autoExpandFirst')) {
  c = c.replace(anchor, `  // 默认展开最新一条，直接看到配图与互动
  (() => {
    const first = document.querySelector('[data-exp]');
    if (first) first.click();
  })();
  $$('[data-exp]').forEach((b) => (b.onclick = () => {`);
  writeFileSync(p, c, 'utf8');
  console.log('auto expand first row');
}