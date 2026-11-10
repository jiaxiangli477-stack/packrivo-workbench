import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
// 表头加一列
const thOld = '<th style="width:90px">价格</th>';
const thNew = '<th style="width:90px">价格</th><th style="width:96px">单价/件</th>';
if (!c.includes(thOld)) { console.log('MISS th'); process.exit(1); }
c = c.replace(thOld, thNew);
// 行内加单价计算
const tdOld = `<td class="num">\${esc(g.price || '—')}</td>`;
const tdNew = `<td class="num">\${esc(g.price || '—')}</td>
          <td class="num">\${(() => {
            const pr = parseFloat(String(g.price || '').replace(/[^0-9.]/g, ''));
            const m = String(g.title || '').match(/(\\d{1,4})\\s*(?:pcs|pieces|pack|set|count)/i);
            const n = m ? parseInt(m[1], 10) : 0;
            return pr && n > 1 ? '$' + (pr / n).toFixed(2) : '—';
          })()}</td>`;
if (!c.includes(tdOld)) { console.log('MISS td'); process.exit(1); }
c = c.replace(tdOld, tdNew);
writeFileSync(p, c, 'utf8');
console.log('unit price column added');