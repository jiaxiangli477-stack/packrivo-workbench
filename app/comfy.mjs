import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const MEDIA = join(process.cwd(), 'data', 'media');
const SD_SERVICE = process.env.SD_SERVICE || 'http://127.0.0.1:8189';

export async function comfyStatus() {
  try {
    const r = await fetch(COMFY + '/system_stats', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    const j = await r.json();
    return { ok: true, devices: j.devices || [], version: j.system?.comfyui_version || '' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function listCheckpoints() {
  try {
    const r = await fetch(COMFY + '/object_info/CheckpointLoaderSimple', { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    return j.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
  } catch {
    return [];
  }
}

/* 选模型 + 参数：SDXL-Turbo 用 4-8 步、cfg 1.0-2.0；SD1.5 用 25 步、cfg 7 */
function profile(model) {
  const isTurbo = /turbo/i.test(model);
  const isXL = /xl/i.test(model);
  return {
    steps: isTurbo ? 6 : 25,
    cfg: isTurbo ? 1.5 : 7,
    size: isTurbo ? 832 : (isXL ? 1024 : 768),
  };
}

export async function generateImage({ prompt, negative = '', width, height, model, prefix = 'swb' }) {
  mkdirSync(MEDIA, { recursive: true });
  const ckpts = await listCheckpoints();
  if (!ckpts.length) throw new Error('ComfyUI 里没有模型（models/checkpoints 为空）');
  const ckpt = model && ckpts.includes(model)
    ? model
    : (ckpts.find((c) => /v1-5/i.test(c)) || ckpts.find((c) => !/xl|turbo/i.test(c)) || ckpts[0]);
  const p = profile(ckpt);
  const w = width || p.size;
  const h = height || p.size;

  const wf = {
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    5: { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: negative || 'text, watermark, logo, blurry, low quality, distorted', clip: ['4', 1] } },
    3: {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 1e12),
        steps: p.steps, cfg: p.cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1,
        model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
      },
    },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: prefix, images: ['8', 0] } },
  };

  const q = await fetch(COMFY + '/prompt', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: wf, client_id: 'swb-' + Date.now() }),
    signal: AbortSignal.timeout(30000),
  });
  if (!q.ok) throw new Error('ComfyUI 入队失败 ' + q.status + ' ' + (await q.text()).slice(0, 200));
  const { prompt_id: pid } = await q.json();

  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const hr = await fetch(COMFY + '/history/' + pid, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()).catch(() => null);
    const entry = hr?.[pid];
    if (!entry) continue;
    const img = entry.outputs?.['9']?.images?.[0];
    if (!img) continue;
    const v = await fetch(`${COMFY}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`, { signal: AbortSignal.timeout(30000) });
    if (!v.ok) throw new Error('取图失败 ' + v.status);
    const buf = Buffer.from(await v.arrayBuffer());
    const name = 'gen-' + Date.now() + '.png';
    writeFileSync(join(MEDIA, name), buf);
    return { file: join(MEDIA, name), url: '/api/media/' + name, model: ckpt, width: w, height: h, bytes: buf.length };
  }
  throw new Error('出图超时（180s）');
}


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
