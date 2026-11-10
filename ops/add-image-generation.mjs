import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: 图像生成接口 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/api/image/status')) {
  s = s.replace(
    "import { warmupAlibaba } from './browser.mjs';",
    "import { warmupAlibaba } from './browser.mjs';\nimport { comfyStatus, listCheckpoints, generateImage } from './comfy.mjs';"
  );

  s = s.replace(
    '/* ---------- 配图提示词',
    `/* ---------- 本地出图（ComfyUI） ---------- */
on('GET', /^\\/api\\/image\\/status$/, async () => {
  const st = await comfyStatus();
  const ckpts = st.ok ? await listCheckpoints() : [];
  return { ...st, checkpoints: ckpts };
});

on('POST', /^\\/api\\/contents\\/(\\d+)\\/generate-image$/, async (m, b) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');
  const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;

  /* 1) 已有提示词就用，没有就让模型写一段 */
  let prompt = '';
  let negative = '';
  let ratio = b.ratio || '4:5';
  if (c.image_prompt) {
    try {
      const o = JSON.parse(c.image_prompt);
      prompt = o.prompt || '';
      negative = o.negative || '';
      ratio = o.ratio || ratio;
    } catch {}
  }
  if (!prompt) {
    const ask = \`Write one English image prompt (60-90 words) for a commercial product photo used with this post. No text in the image.
Post: \${c.title || ''} \${String(c.body || '').slice(0, 300)}
\${product ? 'Product: ' + product.name + ' — ' + (product.selling_points || '') : ''}
Style: clean studio, soft natural light, neutral background, jewelry/candle/gift packaging context, negative space for copy, vertical \${ratio}.
Output JSON only: {"prompt":"...","negative":"..."}\`;
    const r = await chat({ task: 'analyze', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });
    const objs = jsonObjectsIn(r.content).reverse();
    const o = objs.find((x) => x && x.prompt) || {};
    prompt = o.prompt || ('commercial product photography of ' + (product?.name || 'custom packaging') + ', clean studio, soft light, no text');
    negative = o.negative || '';
  }

  const [w, h] = ratio.split(':').map(Number);
  const base = 1024;
  const width = w && h ? Math.round(base * (w / Math.max(w, h))) : 832;
  const height = w && h ? Math.round(base * (h / Math.max(w, h))) : 1024;

  const out = await generateImage({ prompt, negative, width, height });
  run('update content set image_path = ?, image_alt = ? where id = ?', out.file, prompt.slice(0, 300), id);
  audit('content.generate_image', String(id), { model: out.model, bytes: out.bytes });
  return { ok: true, url: out.url, file: out.file, model: out.model, width: out.width, height: out.height, prompt };
});

/* ---------- 配图提示词`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: image generate route added');
}

/* ---------- UI ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');

if (!a.includes('data-genimg')) {
  /* 审核卡片：配图提示词 后面加「生成配图」 */
  a = a.replace(
    '<button class="btn ghost tiny" data-imgprompt="${c.id}">配图提示词</button>',
    '<button class="btn ghost tiny" data-genimg="${c.id}">生成配图</button>'
  );

  /* 绑定 */
  a = a.replace(
    "  $$('[data-ok]').forEach((b) => (b.onclick = async (ev) => {",
    `  $$('[data-genimg]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.genimg;
    const old = b.textContent;
    b.disabled = true; b.textContent = '出图中…';
    try {
      const r = await api('/api/contents/' + id + '/generate-image', 'POST', {});
      const card = b.closest('.rv-card');
      if (card) {
        const body = card.querySelector('.rv-body');
        let img = card.querySelector('img.genimg');
        if (!img) {
          img = document.createElement('img');
          img.className = 'genimg';
          img.style.cssText = 'max-width:320px;border-radius:10px;margin-bottom:10px;display:block';
          body.insertBefore(img, body.firstChild);
        }
        img.src = r.url + '?t=' + Date.now();
      }
      toast('配图已生成（' + r.model + '，' + r.width + 'x' + r.height + '）');
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = old;
  }));
  $$('[data-ok]').forEach((b) => (b.onclick = async (ev) => {`
  );

  writeFileSync(ap, a, 'utf8');
  console.log('ui: generate image button added');
}
