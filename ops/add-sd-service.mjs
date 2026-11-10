import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- comfy.mjs: 增加 diffusers 常驻服务通道 ---------- */
const cp = 'E:/破甲工作区/social-workbench/app/comfy.mjs';
let c = readFileSync(cp, 'utf8');
if (!c.includes('SD_SERVICE')) {
  c = c.replace(
    "const MEDIA = join(process.cwd(), 'data', 'media');",
    `const MEDIA = join(process.cwd(), 'data', 'media');
const SD_SERVICE = process.env.SD_SERVICE || 'http://127.0.0.1:8189';`
  );
  c += `

/* diffusers 常驻服务（8189）：比 ComfyUI 稳，优先用它 */
export async function sdServiceStatus() {
  try {
    const r = await fetch(SD_SERVICE + '/health', { signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    return { ok: !!j.ok, model: j.model || '', device: j.device || '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function sdServiceGenerate({ prompt, negative = '', width = 768, height = 960, steps = 25, cfg = 7 }) {
  const r = await fetch(SD_SERVICE + '/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, negative, width, height, steps, cfg }),
    signal: AbortSignal.timeout(300000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('SD 服务 ' + r.status + ' ' + text.slice(0, 200));
  const j = JSON.parse(text);
  if (!j.ok) throw new Error(j.error || 'SD 服务失败');
  return { file: j.file, url: j.url, model: 'sd15-diffusers', width: j.width, height: j.height, bytes: 0, ms: j.ms };
}
`;
  writeFileSync(cp, c, 'utf8');
  console.log('comfy.mjs: sd service channel added');
}

/* ---------- server: 优先 diffusers 服务 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

rep('import-sd',
  "import { comfyStatus, listCheckpoints, generateImage } from './comfy.mjs';",
  "import { comfyStatus, listCheckpoints, generateImage, sdServiceStatus, sdServiceGenerate } from './comfy.mjs';");

rep('local-pick',
  `  let out;
  if (imageApiCfg()) {`,
  `  let out;
  const sd = await sdServiceStatus();
  if (!imageApiCfg() && sd.ok) {
    out = await sdServiceGenerate({ prompt, negative, width, height });
  } else if (imageApiCfg()) {`);

rep('batch-pick',
  `      const cfg = imageApiCfg();
      const out = cfg
        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) })
        : await generateImage({ prompt, negative, width, height });`,
  `      const cfg = imageApiCfg();
      const sd = await sdServiceStatus();
      const out = cfg
        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) })
        : (sd.ok ? await sdServiceGenerate({ prompt, negative, width, height }) : await generateImage({ prompt, negative, width, height }));`);

rep('status-add',
  "  return { ...st, checkpoints: ckpts, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' } };",
  "  const sd = await sdServiceStatus();\n  return { ...st, checkpoints: ckpts, sd_service: sd, external: { configured: !!api, base: api ? api.base : '', model: api ? api.model : '' } };");

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));
