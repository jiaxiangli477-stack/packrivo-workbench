import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- channels.mjs: Bluesky 带图 ---------- */
const p = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, () => b); done.push(n); };

rep('blob-import', "import { setting, get, run } from './db.mjs';",
  "import { setting, get, run } from './db.mjs';\nimport { readFileSync } from 'node:fs';\nimport sharp from 'sharp';");

rep('bluesky-embed',
  `      const rec = {
        repo: s.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() },
      };`,
  `      const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() };

      // 有配图就上传 blob 并挂 embed（Bluesky 单图上限 1MB，这里统一转 1200px JPEG）
      if (content.image_path) {
        try {
          const jpg = await sharp(readFileSync(content.image_path))
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 86 })
            .toBuffer();
          const up = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + s.accessJwt, 'content-type': 'image/jpeg' },
            body: jpg,
          });
          if (up.ok) {
            const { blob } = await up.json();
            const meta = await sharp(jpg).metadata();
            record.embed = {
              $type: 'app.bsky.embed.images',
              images: [{ alt: content.image_alt || content.title || 'Custom packaging sample', image: blob,
                aspectRatio: { width: meta.width || 1200, height: meta.height || 1200 } }],
            };
          }
        } catch (e) {
          // 图没传上去不影响文字发布，只记一条日志
          run("insert into audit_log(actor, action, target, detail) values ('system','bluesky.image_upload_failed',?,?)", String(content.id || ''), String(e.message).slice(0, 200));
        }
      }

      const rec = { repo: s.did, collection: 'app.bsky.feed.post', record };`);

writeFileSync(p, c, 'utf8');
console.log('channels done:', done.join(', '));

/* ---------- db: content.image_path / image_alt ---------- */
const dp = 'E:/破甲工作区/social-workbench/app/db.mjs';
let d = readFileSync(dp, 'utf8');
if (!d.includes('image_path')) {
  d = d.replace(
    "  image_prompt text,",
    "  image_prompt text,\n  image_path text,\n  image_alt text,"
  );
  d = d.replace(
    "/* 老库补列：content.image_prompt */",
    `/* 老库补列：content.image_path / image_alt */
{
  const cols = db.prepare('PRAGMA table_info(content)').all().map((c) => c.name);
  if (!cols.includes('image_path')) db.exec('alter table content add column image_path text');
  if (!cols.includes('image_alt')) db.exec('alter table content add column image_alt text');
}

/* 老库补列：content.image_prompt */`
  );
  writeFileSync(dp, d, 'utf8');
  console.log('db: image_path/image_alt added');
}

/* ---------- server: /api/media 静态服务 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/api/media/')) {
  s = s.replace(
    "/* ---------- 平台目录 ---------- */",
    `/* ---------- 本地素材 ---------- */
on('GET', /^\\/api\\/media\\/([\\w.\\-]+\\.(?:jpg|jpeg|png|webp))$/, async (m, b, req, res) => {
  const { createReadStream, existsSync } = await import('node:fs');
  const { join, extname } = await import('node:path');
  const file = join(process.cwd(), 'data', 'media', m[1]);
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return { __handled: true }; }
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' });
  createReadStream(file).pipe(res);
  return { __handled: true };
});

/* ---------- 平台目录 ---------- */`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: /api/media added');
}
