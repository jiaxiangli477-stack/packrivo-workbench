import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const MEDIA = 'E:/破甲工作区/social-workbench/data/media';
mkdirSync(MEDIA, { recursive: true });

const jobs = [
  ['https://www.packrivo.com/wp-content/uploads/r4/product-images/P01-rigid-magnetic-jewelry-box-1200.webp', 'bsky-magnetic-01.jpg'],
  ['https://www.packrivo.com/wp-content/themes/packrivo-static-bridge-1.2.38/packrivo-static/assets/product-explainer-inserts.webp', 'bsky-insert-01.jpg'],
  ['https://www.packrivo.com/wp-content/uploads/r4/product-images/P03-lid-and-base-jewelry-box-1200.webp', 'bsky-lidbase-01.jpg'],
];

for (const [url, name] of jobs) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) { console.log(name, 'HTTP', res.status); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const out = join(MEDIA, name);
    const jpg = await sharp(buf).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, jpg);
    const m = await sharp(jpg).metadata();
    console.log(name, buf.length, '->', jpg.length, 'bytes', m.width + 'x' + m.height);
  } catch (e) {
    console.log(name, 'ERR', e.message);
  }
}
