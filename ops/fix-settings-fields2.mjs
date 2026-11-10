import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

const anchor = "${f('apify_token', 'Apify Token（TikTok/IG 找爆款）')}";
if (!c.includes(anchor)) { console.log('MISS anchor'); process.exit(1); }

const html = [
  anchor,
  '        <div class="field"><label>图像 API Base（主）</label><input id="s-image_api_base" placeholder="https://tokenstation.top/v1" /></div>',
  '        <div class="field"><label>图像 API Key（主）</label><input id="s-image_api_key" type="password" /></div>',
  '        <div class="field"><label>图像模型（主）</label><input id="s-image_api_model" placeholder="gpt-image-2" /></div>',
  '        <div class="field"><label>图像 API Base（备）</label><input id="s-image_api_backup_base" placeholder="https://tokenstation.top/v1" /></div>',
  '        <div class="field"><label>图像 API Key（备）</label><input id="s-image_api_backup_key" type="password" /></div>',
  '        <div class="field"><label>图像模型（备）</label><input id="s-image_api_backup_model" placeholder="gpt-image-2.5" /></div>',
  '        <div class="field"><label>Telegram Bot Token</label><input id="s-telegram_bot_token" type="password" /></div>',
  '        <div class="field"><label>Telegram chat_id</label><input id="s-telegram_chat_id" placeholder="@channel 或 -100xxx" /></div>',
].join('\n');

c = c.replace(anchor, () => html);

const keysOld = "'apify_token', 'apify_actor'";
const keysNew = "'apify_token', 'apify_actor', 'image_api_base', 'image_api_key', 'image_api_model', 'image_api_backup_base', 'image_api_backup_key', 'image_api_backup_model', 'telegram_bot_token', 'telegram_chat_id'";
c = c.split(keysOld).join(keysNew);

writeFileSync(p, c, 'utf8');
console.log('fields inserted:', c.includes('s-image_api_backup_key'));
