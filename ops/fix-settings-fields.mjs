import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const anchor = "${f('apify_token', 'Apify Token（TikTok/IG 找爆款）')}";
if (!c.includes(anchor)) { console.log('MISS anchor'); process.exit(1); }
const extra = `${f('apify_token', 'Apify Token（TikTok/IG 找爆款）')}
        ${f('image_api_base', '图像 API Base（主通道）', 'password')}
        ${f('image_api_key', '图像 API Key（主通道）', 'password')}
        ${f('image_api_model', '图像模型名（主通道）')}
        ${f('image_api_backup_base', '图像 API Base（备用）')}
        ${f('image_api_backup_key', '图像 API Key（备用）', 'password')}
        ${f('image_api_backup_model', '图像模型名（备用）')}
        ${f('telegram_bot_token', 'Telegram Bot Token', 'password')}
        ${f('telegram_chat_id', 'Telegram 频道 / chat_id')}`;
c = c.replace(anchor, () => extra);
// keys 数组补全
const keysOld = "'apify_token', 'apify_actor'";
const keysNew = "'apify_token', 'apify_actor', 'image_api_base', 'image_api_key', 'image_api_model', 'image_api_backup_base', 'image_api_backup_key', 'image_api_backup_model', 'telegram_bot_token', 'telegram_chat_id'";
c = c.split(keysOld).join(keysNew);
writeFileSync(p, c, 'utf8');
console.log('fields inserted');