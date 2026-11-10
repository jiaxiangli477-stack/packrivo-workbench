import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

/* 1) 第三条通道配置 */
rep('fallback-cfg',
  `/* 备用通道（第二个 Key / 第二个站） */
function imageApiBackupCfg() {`,
  `/* 第三通道（兜底，前两条都失败才用） */
function imageApiFallbackCfg() {
  const base = String(setting('image_api_fallback_base') || '').trim().replace(/\\/$/, '');
  const key = String(setting('image_api_fallback_key') || '').trim();
  const model = String(setting('image_api_fallback_model') || '').trim() || 'gemini-nano-banana-2.1';
  if (!base || !key) return null;
  return { base, key, model, asyncMode: true };
}

/* 备用通道（第二个 Key / 第二个站） */
function imageApiBackupCfg() {`);

rep('endpoints',
  "function imageEndpoints() {\n  return [imageApiCfg(), imageApiBackupCfg()].filter(Boolean);\n}",
  "function imageEndpoints() {\n  return [imageApiCfg(), imageApiBackupCfg(), imageApiFallbackCfg()].filter(Boolean);\n}");

/* 2) 重写单通道调用：支持比例尺寸 + 异步任务轮询 */
const startMark = 'async function generateImageWith(cfg, { prompt, size = \'1024x1024\' }) {';
const endMark = '  const b64 = j.data?.[0]?.b64_json';
const i0 = s.indexOf(startMark);
const i1 = s.indexOf(endMark, i0);
if (i0 < 0 || i1 < 0) { console.log('MISS rewrite block', i0, i1); process.exit(1); }

const body = `async function generateImageWith(cfg, { prompt, size = '1024x1024', ratio = '4:5' }) {
  const isRatioModel = /nano-banana|gemini|seedream|flux/i.test(cfg.model);
  const sizeArg = isRatioModel ? ratio : size;

  let r = null;
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await fetch(cfg.base + '/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: sizeArg }),
      signal: AbortSignal.timeout(180000),
    });
    text = await r.text();
    if (r.ok) break;
    if (r.status === 503 && attempt < 2) { await new Promise((res) => setTimeout(res, 4000)); continue; }
    break;
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + text.slice(0, 200));

  const j = JSON.parse(text);
  const first = j.data?.[0] || j;

  /* 异步任务：先拿 task_id，再轮询 /tasks/{id} */
  const taskId = first.task_id || first.id;
  if (taskId && (first.status === 'submitted' || first.status === 'processing' || !first.b64_json && !first.url)) {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 3000));
      const pr = await fetch(cfg.base + '/tasks/' + taskId, { headers: { authorization: 'Bearer ' + cfg.key }, signal: AbortSignal.timeout(30000) });
      if (!pr.ok) continue;
      const pj = await pr.json();
      const d = pj.data || pj;
      if (d.status === 'failed' || d.status === 'error') throw new Error('任务失败：' + JSON.stringify(d).slice(0, 160));
      if (d.status !== 'completed') continue;
      const raw = d.result?.images?.[0]?.url || d.result?.images?.[0] || d.result?.url;
      const imgUrl = Array.isArray(raw) ? raw[0] : raw;
      if (!imgUrl) throw new Error('任务完成但没有图片地址');
      const img = await fetch(imgUrl, { signal: AbortSignal.timeout(90000) });
      if (!img.ok) throw new Error('下载图片失败 ' + img.status);
      const buf = Buffer.from(await img.arrayBuffer());
      const { writeFileSync: wf, mkdirSync } = await import('node:fs');
      const { join } = await import('node:path');
      const dir = join(process.cwd(), 'data', 'media');
      mkdirSync(dir, { recursive: true });
      const name = 'api-' + Date.now() + '.jpg';
      wf(join(dir, name), buf);
      return { file: join(dir, name), url: '/api/media/' + name, model: cfg.model, width: '', height: '', bytes: buf.length };
    }
    throw new Error('任务超时（240s）');
  }

`;

s = s.slice(0, i0) + body + s.slice(i1);

/* 3) 传 ratio 进去 */
rep('call-ratio',
  "      return await generateImageWith(cfg, { prompt, size });",
  "      return await generateImageWith(cfg, { prompt, size, ratio });");
rep('sig-ratio',
  "async function generateImageExternal({ prompt, size = '1024x1024' }) {",
  "async function generateImageExternal({ prompt, size = '1024x1024', ratio = '4:5' }) {");

/* 4) 调用处带上 ratio */
rep('route-ratio',
  "    out = await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) });",
  "    out = await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height), ratio });");
rep('batch-ratio',
  "        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) })",
  "        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height), ratio })");

/* 5) 状态里显示第三条 */
rep('status-third',
  "  const backup = imageApiBackupCfg();",
  "  const backup = imageApiBackupCfg();\n  const fallback = imageApiFallbackCfg();");
rep('status-third-out',
  ", backup: { configured: !!backup, model: backup ? backup.model : '' } };",
  ", backup: { configured: !!backup, model: backup ? backup.model : '' }, fallback: { configured: !!fallback, model: fallback ? fallback.model : '' } };");

writeFileSync(p, s, 'utf8');
console.log('done:', done.join(', '));
