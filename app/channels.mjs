import { setting, get, run, all } from './db.mjs';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { decrypt } from './crypto.mjs';
import { PublishError } from './errors.mjs';
import { publish as publishPostiz, status as postizStatus, health as postizHealth, reachable as postizReachable } from './postiz.mjs';

export { PublishError };

function platformKey(account, platform) {
  return platform || account?.platform || '';
}

/* 通道状态不许写死 ready：按"这个平台是否真有带齐凭证的活跃账号"判定 */
function credReadyCount(platform, fields) {
  const accts = all("select id from account where platform = ? and status = 'active'", platform);
  let n = 0;
  for (const a of accts) {
    let ok = true;
    for (const f of fields) {
      if (!cred(a.id, f)) { ok = false; break; }
    }
    if (ok) n += 1;
  }
  return n;
}

async function postJson(url, body, headers = {}, timeoutMs = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}


/* 账凭据读取：同名字段取最新一条并解密 */
function cred(accountId, field) {
  if (!accountId) return null;
  const row = get(
    "select cipher from credential where owner_kind = 'account' and owner_id = ? and field = ? order by id desc limit 1",
    accountId, field
  );
  if (!row) return null;
  try { return decrypt(row.cipher); } catch { return null; }
}

function postText(content) {
  const parts = [content.title, content.body].filter(Boolean);
  let text = parts.join('\n\n').trim();
  const link = String(content.utm_url || '').trim();
  if (link && !text.includes(link)) text += '\n\n' + link;
  if (content.hashtags) text += '\n\n' + content.hashtags;
  return text.trim();
}

export const channels = {
  mock: {
    label: '本地模拟通道',
    state: 'ready',
    note: '把发布结果写进本地库，用来跑通全链路，不接触任何平台',
    async publish({ content }) {
      const id = `mock-${Date.now().toString(36)}`;
      return { ok: true, post_id: id, platform_post_id: id, public_url: `local://mock/${id}`, delivery_state: 'submitted' };
    },
  },

  webhook: {
    label: '自定义 Webhook',
    get state() { return setting('webhook_url') ? 'ready' : 'pending_config'; },
    note: '把内容 POST 到你自己的接收端（可对接 n8n / Postiz / 自建服务）',
    async publish({ content, account, platform }) {
      const url = setting('webhook_url');
      if (!url) throw new PublishError('pending_config', '未配置 webhook_url');
      const r = await postJson(url, {
        platform: platformKey(account, platform),
        account: account?.handle || '',
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
        utm_url: content.utm_url,
      });
      if (r.status < 200 || r.status >= 300) throw new PublishError('upstream_error', `webhook 返回 ${r.status}`, r.text.slice(0, 300), { dispatched: true, outcomeKnown: true });
      // 2xx 不等于发成功：接收端必须回 JSON 且带 id，否则这条不能记成已发布。
      // 但这两种情况的真实语义是「请求已经送达、对方可能已经处理了」→ 结果未知，只能人工核对，不能重发。
      let j;
      try {
        j = JSON.parse(r.text || '');
      } catch {
        throw new PublishError('upstream_error', 'webhook 返回 2xx 但不是 JSON，无法确认接收端已接收（请让接收端回 {"id":"..."}）', r.text.slice(0, 300), { dispatched: true, outcomeKnown: false });
      }
      const postId = String(j?.id || j?.post_id || j?.postId || '');
      if (!postId) throw new PublishError('upstream_error', 'webhook 返回 2xx 但没有 id 字段，按未确认处理（请让接收端回 {"id":"..."}）', JSON.stringify(j).slice(0, 300), { dispatched: true, outcomeKnown: false });
      return { ok: true, post_id: postId, url: j.url || '', platform_post_id: postId, public_url: j.url || '', delivery_state: 'submitted' };
    },
  },


  /* 直连 Mastodon：不需要任何平台审核，填实例地址 + access token 即可发 */
  mastodon: {
    label: 'Mastodon（直连）',
    get state() { return credReadyCount('mastodon', ['access_token']) ? 'ready' : 'pending_config'; },
    note: '在账号页填「实例域名」和「access token」；发布走 /api/v1/statuses',
    async publish({ content, account }) {
      const id = account?.id;
      const instance = cred(id, 'instance') || (account?.profile_url || '').replace(/^https?:\/\//, '').split('/')[0];
      const token = cred(id, 'access_token');
      if (!instance || !token) throw new PublishError('pending_config', 'Mastodon 未配置：需要 instance 与 access_token');
      const r = await postJson(
        'https://' + instance.replace(/\/$/, '') + '/api/v1/statuses',
        { status: postText(content).slice(0, 4000), visibility: 'public' },
        { authorization: 'Bearer ' + token }
      );
      if (r.status < 200 || r.status >= 300) throw new PublishError('upstream_error', 'Mastodon 返回 ' + r.status, r.text.slice(0, 300));
      const j = JSON.parse(r.text || '{}');
      return { ok: true, post_id: String(j.id || ''), url: j.url || '' };
    },
  },

  /* 直连 Bluesky：app password + handle，走 AT Protocol */
  bluesky: {
    label: 'Bluesky（直连）',
    get state() { return credReadyCount('bluesky', ['app_password']) ? 'ready' : 'pending_config'; },
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
      // 链接走 link card，正文里把裸链接和 "View details:" 之类的引导语去掉，空出字符给标签
      const cleanBody = String(content.body || '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/(view details|see details|details|link|more info)\s*[:：]\s*$/i, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const head = [content.title, cleanBody].filter(Boolean).join('\n\n').trim();

      /* 预算先行：正文 + 标签 ≤300；超了先丢标签，再截正文 */
      let text = [head, tags].filter(Boolean).join('\n\n');
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
            description: String(content.body || '').replace(/\s+/g, ' ').slice(0, 180),
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

  /* Telegram：Bot 发频道/群，走 webhook 通道，不需要平台审核 */
  telegram: {
    label: 'Telegram（Bot）',
    get state() { return setting('telegram_bot_token') && setting('telegram_chat_id') ? 'ready' : 'pending_config'; },
    note: '设置里填 Bot Token 与频道 @username 或 chat_id；有图走 sendPhoto，无图走 sendMessage',
    async publish({ content }) {
      const token = setting('telegram_bot_token');
      const chat = setting('telegram_chat_id');
      if (!token || !chat) throw new PublishError('pending_config', 'Telegram 未配置：设置里填 Bot Token 与 chat_id');

      const text = [content.title, content.body, content.utm_url, content.hashtags].filter(Boolean).join('\n\n');
      const base = 'https://api.telegram.org/bot' + token;

      if (content.image_path) {
        const form = new FormData();
        form.append('chat_id', chat);
        form.append('caption', text.slice(0, 1024));
        const { readFileSync: rf } = await import('node:fs');
        form.append('photo', new Blob([rf(content.image_path)], { type: 'image/jpeg' }), 'photo.jpg');
        const r = await fetch(base + '/sendPhoto', { method: 'POST', body: form });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new PublishError('upstream_error', 'Telegram sendPhoto 失败 ' + r.status, JSON.stringify(j).slice(0, 200));
        return { ok: true, post_id: String(j.result?.message_id || ''), url: 'https://t.me/' + String(chat).replace(/^@/, '') };
      }

      const r = await postJson(base + '/sendMessage', { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: false });
      if (r.status < 200 || r.status >= 300) throw new PublishError('upstream_error', 'Telegram sendMessage 失败 ' + r.status, r.text.slice(0, 200));
      const j = JSON.parse(r.text || '{}');
      return { ok: true, post_id: String(j.result?.message_id || ''), url: 'https://t.me/' + String(chat).replace(/^@/, '') };
    },
  },

  postiz: {
    label: 'Postiz 发布中心',
    // 状态按实时配置判定：地址 + API Key 都齐了才算 ready（真正连通性由 /api/channels/postiz/verify 验证）
    get state() {
      const s = postizStatus();
      if (!s.configured) return 'pending_config';
      if (s.connectivity === 'key_invalid') return 'pending_credential';   // key 不对 ≠ 连不上
      if (s.connectivity === 'unreachable') return 'pending_connect';
      return 'ready';
    },
    // /api/channels 用这个异步版：没探过就真去探一次（带缓存），省得重启后一律谎报 ready
    async resolveState() {
      const s = postizStatus();
      if (!s.configured) return 'pending_config';
      const h = await postizReachable();
      if (h === null) return 'pending_connect';
      // key 无效与连不上要分开报，别把 401 说成"服务没连上"
      if (h.ok === false) {
        const authRe = /401|403|鉴权|Invalid API key|No API Key|API Key 不对|拒绝鉴权/i;
        return authRe.test(h.error) ? 'pending_credential' : 'pending_connect';
      }
      return 'ready';
    },
    note: '自建 Postiz，走它的公开 API v1（Authorization: <api key>）；通道按 integration identifier 自动匹配',
    async publish({ content, account, platform, schedule }) {
      return publishPostiz({ content, account, platform, schedule });
    },
  },

  official: {
    label: '平台官方 API',
    state: 'pending_credential',
    note: '需要各平台开发者资质与 App 审核；当前未接入，接入后按平台拆成独立适配器',
    async publish() {
      throw new PublishError('pending_integration', '官方 API 适配器未接入（需要平台开发者审核与凭证）');
    },
  },
};

export function channelFor(name, platform) {
  const c = channels[name];
  if (c) return { key: name, ...c };
  if (platform === 'mock') return { key: 'mock', ...channels.mock };
  return { key: 'official', ...channels.official };
}

export async function channelCatalog() {
  const out = [];
  for (const [key, v] of Object.entries(channels)) {
    // 有 resolveState 的通道要求真实探测（目前只有 postiz）；其余走同步 getter
    const state = typeof v.resolveState === 'function' ? await v.resolveState() : v.state;
    out.push({ key, label: v.label, state, note: v.note });
  }
  return out;
}
