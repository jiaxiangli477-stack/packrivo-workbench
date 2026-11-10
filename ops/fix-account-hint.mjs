import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const old = '<div class="field"><label>发到账号</label><select data-acc="${c.id}">${accounts.map((a) => `<option value="${a.id}" ${a.platform === c.platform ? \'selected\' : \'\'}>';
if (!c.includes(old)) { console.log('MISS'); process.exit(0); }
const neu = '<div class="field"><label>发到账号</label><select data-acc="${c.id}">${accounts.some((a) => a.platform === c.platform) ? "" : `<option value="" selected disabled>⚠ 还没有 ${esc(c.platform)} 账号，先去「账号」页添加</option>`}${accounts.map((a) => `<option value="${a.id}" ${a.platform === c.platform ? \'selected\' : \'\'}>';
c = c.replace(old, neu);
writeFileSync(p, c, 'utf8');
console.log('account hint added');