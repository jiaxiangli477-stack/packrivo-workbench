import { readFileSync, writeFileSync } from 'node:fs';

/* 外部图像 API：503 重试 3 次，错误信息带上上游原文 */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const old = `async function generateImageExternal({ prompt, size = '1024x1024' }) {
  const cfg = imageApiCfg();
  const r = await fetch(cfg.base + '/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, size, response_format: 'b64_json' }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('外部图像 API ' + r.status + ' ' + text.slice(0, 200));`;
const neu = `async function generateImageExternal({ prompt, size = '1024x1024' }) {
  const cfg = imageApiCfg();
  let r = null;
  let text = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await fetch(cfg.base + '/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, prompt, n: 1, size, response_format: 'b64_json' }),
      signal: AbortSignal.timeout(180000),
    });
    text = await r.text();
    if (r.ok) break;
    if (r.status === 503 && attempt < 3) { await new Promise((res) => setTimeout(res, 6000)); continue; }
    break;
  }
  if (!r.ok) throw new Error('外部图像 API ' + r.status + ' ' + text.slice(0, 240));`;
if (!s.includes(old)) { console.log('anchor missing'); process.exit(1); }
s = s.replace(old, () => neu);
writeFileSync(sp, s, 'utf8');
console.log('external image retry added');
