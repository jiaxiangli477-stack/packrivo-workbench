import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(p, 'utf8');

const start = c.indexOf('  bluesky: {');
const endMark = '\n  postiz: {';
const end = c.indexOf(endMark);
if (start < 0 || end < 0) { console.log('bluesky block anchors missing', start, end); process.exit(1); }

const block = `  bluesky: {
    label: 'Bluesky（直连）',
    get state() { return 'ready'; },
    note: '文字 + 链接卡片（link card，图片作为卡片缩略图）；正文只放正文和标签，链接不占 300 字符',
    async publish({ content, account }) {
      const id = account?.id;
      const handle = cred(id, 'handle') || account?.handle?.replace(/^@/, '');
      const password = cred(id, 'app_password');
      if (!handle || !password) throw new PublishError('pending_config', 'Bluesky 未配置：需要 handle 与 app_password');

      const sess = await postJson('https://bsky.social/xrpc/com.atproto.server.createSession', { identifier: handle, password });
      if (sess.status < 200 || sess.status >= 300) throw new PublishError('auth_failed', 'Bluesky 登录失败 ' + sess.status, sess.text.slice(0, 200));
      const s = JSON.parse(sess.text);

      const link = String(content.utm_url || '').trim();
      const tags = String(content.hashtags || '').trim();
      const head = [content.title, content.body].filter(Boolean).join('\\n\\n').trim();

      /* 预算先行：正文 + 标签 ≤300；超了先丢标签，再截正文 */
      let text = [head, tags].filter(Boolean).join('\\n\\n');
      if (text.length > 300) text = head;
      if (text.length > 297) text = text.slice(0, 297) + '...';

      /* 缩略图（link card 用） */
      let thumb = null;
      let aspect = null;
      if (content.image_path) {
        try {
          const jpg = await sharp(readFileSync(content.image_path))
            .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          const up = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + s.accessJwt, 'content-type': 'image/jpeg' },
            body: jpg,
          });
          if (up.ok) { thumb = (await up.json()).blob; const m = await sharp(jpg).metadata(); aspect = { width: m.width, height: m.height }; }
        } catch {}
      }

      const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() };

      if (link) {
        record.embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: link,
            title: content.title || 'Packrivo custom packaging',
            description: String(content.body || '').replace(/\\s+/g, ' ').slice(0, 180),
            ...(thumb ? { thumb } : {}),
          },
        };
      } else if (thumb) {
        record.embed = {
          $type: 'app.bsky.embed.images',
          images: [{ alt: content.image_alt || content.title || 'Custom packaging', image: thumb, ...(aspect ? { aspectRatio: aspect } : {}) }],
        };
      }

      const rec = { repo: s.did, collection: 'app.bsky.feed.post', record };
      const res = await postJson('https://bsky.social/xrpc/com.atproto.repo.createRecord', rec, { authorization: 'Bearer ' + s.accessJwt });
      if (res.status < 200 || res.status >= 300) throw new PublishError('upstream_error', 'Bluesky 发布失败 ' + res.status, res.text.slice(0, 200));
      const j = JSON.parse(res.text || '{}');
      const rkey = String(j.uri || '').split('/').pop();
      return { ok: true, post_id: rkey, url: 'https://bsky.app/profile/' + handle + '/post/' + rkey };
    },
  },
`;

c = c.slice(0, start) + block + c.slice(end);
writeFileSync(p, c, 'utf8');
console.log('bluesky publish rewritten with link card');
