import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: 外部图像 API 优先，本地兜底 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

rep('image-status',
  `on('GET', /^\\/api\\/image\\/status$/, async () => {
  const st = await comfyStatus();
  const ckpts = st.ok ? await listCheckpoints() : [];
  return { ...st, checkpoints: ckpts };
});`,
  `on('GET', /^\\/api\\/image\\/status$/, async () => {
  const st = await comfyStatus();
  const ckpts = st.ok ? await listCheckpoints() : [];
  const api = imageApiCfg();
  return { ...st, checkpoints: ckpts, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' } };
});

/* 外部图像 API 配置（OpenAI 兼容 /images/generations） */
function imageApiCfg() {
  const base = String(setting('image_api_base') || '').trim().replace(/\\/$/, '');
  const key = String(setting('image_api_key') || '').trim();
  const model = String(setting('image_api_model') || '').trim() || 'dall-e-3';
  if (!base || !key) return null;
  return { base, key, model };
}

async function generateImageExternal({ prompt, size = '1024x1024' }) {
  const cfg = imageApiCfg();
  const r = await fetch(cfg.base + '/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, size, response_format: 'b64_json' }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('外部图像 API ' + r.status + ' ' + text.slice(0, 200));
  const j = JSON.parse(text);
  const b64 = j.data?.[0]?.b64_json || (j.data?.[0]?.url ? null : null);
  if (b64) {
    const { writeFileSync: wf, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'data', 'media');
    mkdirSync(dir, { recursive: true });
    const name = 'api-' + Date.now() + '.png';
    wf(join(dir, name), Buffer.from(b64, 'base64'));
    return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: size.split('x')[0], height: size.split('x')[1], bytes: Buffer.from(b64, 'base64').length };
  }
  const imgUrl = j.data?.[0]?.url;
  if (imgUrl) {
    const img = await fetch(imgUrl, { signal: AbortSignal.timeout(60000) });
    const buf = Buffer.from(await img.arrayBuffer());
    const { writeFileSync: wf, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'data', 'media');
    mkdirSync(dir, { recursive: true });
    const name = 'api-' + Date.now() + '.png';
    wf(join(dir, name), buf);
    return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: '', height: '', bytes: buf.length };
  }
  throw new Error('外部图像 API 没返回图片');
}`);

rep('image-route',
  `  const out = await generateImage({ prompt, negative, width, height });`,
  `  let out;
  if (imageApiCfg()) {
    out = await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) });
  } else {
    out = await generateImage({ prompt, negative, width, height });
  }`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));

/* ---------- UI: 设置页加图像 API 字段 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('image_api_base')) {
  a = a.replace(
    '<div class="field"><label>Telegram Bot Token</label>',
    `<div class="field"><label>图像 API Base（OpenAI 兼容）</label><input id="s-image_api_base" placeholder="https://api.xxx.com/v1" /></div>
          <div class="field"><label>图像 API Key</label><input id="s-image_api_key" type="password" /></div>
          <div class="field"><label>图像模型名</label><input id="s-image_api_model" placeholder="dall-e-3 / seedream / flux" /></div>
          <div class="field"><label>Telegram Bot Token</label>`
  );
  a = a.replace(
    "'apify_token', 'apify_actor', 'telegram_bot_token', 'telegram_chat_id'];",
    "'apify_token', 'apify_actor', 'telegram_bot_token', 'telegram_chat_id', 'image_api_base', 'image_api_key', 'image_api_model'];"
  );
  writeFileSync(ap, a, 'utf8');
  console.log('ui: image api fields added');
}
