import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
if (!c.includes('image_api_backup_key')) {
  c = c.replace(
    '<div class="field"><label>图像模型名</label><input id="s-image_api_model" placeholder="dall-e-3 / seedream / flux" /></div>',
    `<div class="field"><label>图像模型名</label><input id="s-image_api_model" placeholder="dall-e-3 / seedream / flux" /></div>
          <div class="field"><label>备用图像 Base</label><input id="s-image_api_backup_base" placeholder="https://tokenstation.top/v1" /></div>
          <div class="field"><label>备用图像 Key</label><input id="s-image_api_backup_key" type="password" /></div>
          <div class="field"><label>备用图像模型名</label><input id="s-image_api_backup_model" placeholder="gpt-image-2.5" /></div>`
  );
  c = c.replace(
    "'telegram_bot_token', 'telegram_chat_id', 'image_api_base', 'image_api_key', 'image_api_model'];",
    "'telegram_bot_token', 'telegram_chat_id', 'image_api_base', 'image_api_key', 'image_api_model', 'image_api_backup_base', 'image_api_backup_key', 'image_api_backup_model'];"
  );
  writeFileSync(p, c, 'utf8');
  console.log('ui: backup fields added');
} else console.log('already');