import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const MEDIA = 'E:/破甲工作区/social-workbench/data/media';
mkdirSync(MEDIA, { recursive: true });

const src = process.argv[2] || 'https://www.packrivo.com/wp-content/uploads/packrivo-supplier-photos-20261022/pr-sp-drawer-01-800.webp';
const out = process.argv[3] || join(MEDIA, 'bsky-drawer-01.jpg');

const res = await fetch(src, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
const buf = Buffer.from(await res.arrayBuffer());
console.log('downloaded', buf.length, 'bytes from', src);

const jpg = await sharp(buf)
  .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 86, progressive: true })
  .toBuffer();

writeFileSync(out, jpg);
console.log('saved', out, jpg.length, 'bytes');
const meta = await sharp(out).metadata();
console.log('size', meta.width + 'x' + meta.height, meta.format);
