import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const D = String.fromCharCode(36); // '$'

/* 1) 在 num 助手后插入 unitPrice */
const anchor = "      const list = [...(r.products || [])].sort((a, b) => num(b.bought) - num(a.bought) || num(b.reviews) - num(a.reviews));";
const helper = anchor + "\n      const unitPrice = (g) => {\n" +
  "        const pr = parseFloat(String(g.price || '').replace(/[^0-9.]/g, ''));\n" +
  "        const m = String(g.title || '').match(/(\\d{1,4})\\s*(?:pcs|pieces|pack|set|count)/i);\n" +
  "        const n = m ? parseInt(m[1], 10) : 0;\n" +
  "        return pr && n > 1 ? '" + D + "' + (pr / n).toFixed(2) : '—';\n" +
  "      };";
if (!c.includes(anchor)) { console.log('anchor miss'); process.exit(1); }
c = c.replace(anchor, helper);

/* 2) 用 unitPrice 替换坏掉的内联块 */
const badStart = c.indexOf('<td class="num">' + D + '{(() => {');
const badEnd = c.indexOf('<td class="num">' + D + '{g.rating');
if (badStart < 0 || badEnd < 0 || badEnd < badStart) { console.log('bad block not found', badStart, badEnd); process.exit(1); }
c = c.slice(0, badStart) + '<td class="num">' + D + '{unitPrice(g)}</td>\n          ' + c.slice(badEnd);
writeFileSync(p, c, 'utf8');
console.log('unit price repaired');
