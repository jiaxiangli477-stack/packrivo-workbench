import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- channels: Telegram ---------- */
const cp = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(cp, 'utf8');
if (!c.includes('telegram: {')) {
  const block = `  /* Telegram：Bot 发频道/群，走 webhook 通道，不需要平台审核 */
  telegram: {
    label: 'Telegram（Bot）',
    get state() { return setting('telegram_bot_token') && setting('telegram_chat_id') ? 'ready' : 'pending_config'; },
    note: '设置里填 Bot Token 与频道 @username 或 chat_id；有图走 sendPhoto，无图走 sendMessage',
    async publish({ content }) {
      const token = setting('telegram_bot_token');
      const chat = setting('telegram_chat_id');
      if (!token || !chat) throw new PublishError('pending_config', 'Telegram 未配置：设置里填 Bot Token 与 chat_id');

      const text = [content.title, content.body, content.utm_url, content.hashtags].filter(Boolean).join('\\n\\n');
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

`;
  c = c.replace('  postiz: {', block + '  postiz: {');
  writeFileSync(cp, c, 'utf8');
  console.log('channels: telegram added');
}

/* ---------- 设置页：Telegram 字段 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('telegram_bot_token')) {
  a = a.replace(
    '<div class="field"><label>Apify Token（TikTok/IG 找爆款）</label><input id="s-apify_token" type="password" /></div>',
    `<div class="field"><label>Apify Token（TikTok/IG 找爆款）</label><input id="s-apify_token" type="password" /></div>
          <div class="field"><label>Telegram Bot Token</label><input id="s-telegram_bot_token" type="password" placeholder="123456:ABC..." /></div>
          <div class="field"><label>Telegram 频道 / chat_id</label><input id="s-telegram_chat_id" placeholder="@mychannel 或 -1001234567890" /></div>`
  );
  a = a.replace(
    "const keys = ['publish_mode', 'publish_channel_default', 'public_base_url', 'review_sensitive_extra', 'weekly_quota', 'brand_tone', 'primary_lang', 'market', 'webhook_url', 'postiz_base', 'video_api_path', 'apify_token', 'apify_actor'];",
    "const keys = ['publish_mode', 'publish_channel_default', 'public_base_url', 'review_sensitive_extra', 'weekly_quota', 'brand_tone', 'primary_lang', 'market', 'webhook_url', 'postiz_base', 'video_api_path', 'apify_token', 'apify_actor', 'telegram_bot_token', 'telegram_chat_id'];"
  );
  writeFileSync(ap, a, 'utf8');
  console.log('ui: telegram fields added');
}
