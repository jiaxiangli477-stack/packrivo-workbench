import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/comfy.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

/* 6G 显存：默认优先 SD1.5（XL 6.6G 权重会 access violation），除非显式指定 */
rep('ckpt-pick',
  "  const ckpt = model && ckpts.includes(model) ? model : ckpts.find((c) => /turbo/i.test(c)) || ckpts[0];",
  "  const ckpt = model && ckpts.includes(model)\n    ? model\n    : (ckpts.find((c) => /v1-5/i.test(c)) || ckpts.find((c) => !/xl|turbo/i.test(c)) || ckpts[0]);");

rep('size',
  "    size: isXL || isTurbo ? 1024 : 768,",
  "    size: isTurbo ? 832 : (isXL ? 1024 : 768),");

writeFileSync(p, c, 'utf8');
console.log('comfy.mjs default checkpoint:', done.join(', '));
