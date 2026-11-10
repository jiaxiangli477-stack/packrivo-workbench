import { readFileSync, writeFileSync } from 'node:fs';

const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

/* 主/备两条图像通道 */
rep('cfg-list',
  `function imageApiCfg() {
  const base = String(setting('image_api_base') || '').trim().replace(/\\/$/, '');
  const key = String(setting('image_api_key') || '').trim();
  const model = String(setting('image_api_model') || '').trim() || 'dall-e-3';
  if (!base || !key) return null;
  return { base, key, model };
}`,
  `function imageApiCfg() {
  const base = String(setting('image_api_base') || '').trim().replace(/\\/$/, '');
  const key = String(setting('image_api_key') || '').trim();
  const model = String(setting('image_api_model') || '').trim() || 'gpt-image-2';
  if (!base || !key) return null;
  return { base, key, model };
}

/* 备用通道（第二个 Key / 第二个站） */
function imageApiBackupCfg() {
  const base = String(setting('image_api_backup_base') || setting('image_api_base') || '').trim().replace(/\\/$/, '');
  const key = String(setting('image_api_backup_key') || '').trim();
  const model = String(setting('image_api_backup_model') || '').trim() || 'gpt-image-2.5';
  if (!base || !key) return null;
  return { base, key, model };
}

function imageEndpoints() {
  return [imageApiCfg(), imageApiBackupCfg()].filter(Boolean);
}`);

/* 逐通道尝试 */
rep('external-loop',
  `async function generateImageExternal({ prompt, size = '1024x1024' }) {
  const cfg = imageApiCfg();
  let r = null;
  let text = '';
  for (let attempt = 1; attempt <= 3; attempt++) {`,
  `async function generateImageExternal({ prompt, size = '1024x1024' }) {
  const list = imageEndpoints();
  const errors = [];
  for (const cfg of list) {
    try {
      return await generateImageWith(cfg, { prompt, size });
    } catch (e) {
      errors.push((cfg.model || '') + ': ' + String(e.message).slice(0, 120));
    }
  }
  throw new Error('所有图像通道都失败 → ' + errors.join(' | '));
}

async function generateImageWith(cfg, { prompt, size = '1024x1024' }) {
  let r = null;
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {`);

rep('retry-status',
  "    if (r.status === 503 && attempt < 3) { await new Promise((res) => setTimeout(res, 6000)); continue; }",
  "    if (r.status === 503 && attempt < 2) { await new Promise((res) => setTimeout(res, 4000)); continue; }");

rep('err-msg',
  "  if (!r.ok) throw new Error('外部图像 API ' + r.status + ' ' + text.slice(0, 240));",
  "  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + text.slice(0, 200));");

/* 状态里带上两条通道 */
rep('status-both',
  "  const api = imageApiCfg();\n  const sd = await sdServiceStatus();",
  "  const api = imageApiCfg();\n  const backup = imageApiBackupCfg();\n  const sd = await sdServiceStatus();");

rep('status-out',
  "return { ...st, checkpoints: ckpts, sd_service: sd, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' } };",
  "return { ...st, checkpoints: ckpts, sd_service: sd, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' }, backup: { configured: !!backup, model: backup ? backup.model : '' } };");

writeFileSync(sp, s, 'utf8');
console.log('done:', done.join(', '));
