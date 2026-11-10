import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const old = `  audit('content.generate', \`product:\${product.id}\`, { count: made.length, hotspot: hotspot ? hotspot.id : null });
  return { ok: made.length > 0, created: made, errors };`;
const neu = `  audit('content.generate', \`product:\${product.id}\`, { count: made.length, hotspot: hotspot ? hotspot.id : null });
  const wantImage = b.gen_image === true || b.gen_image === '1';
  if (wantImage && made.length) runImageBatch(made.map((x) => x.id)).catch(() => {});
  return { ok: made.length > 0, created: made, errors, image_batch: wantImage };`;
if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('gen_image wired');