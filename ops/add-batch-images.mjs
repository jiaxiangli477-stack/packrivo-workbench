import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: 批量配图（后台任务 + 进度查询） ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/api/images/batch')) {
  s = s.replace(
    '/* ---------- 配图提示词',
    `/* ---------- 批量配图 ---------- */
const imageBatch = { running: false, total: 0, done: 0, ok: 0, failed: 0, current: '', results: [], errors: [], started_at: '', finished_at: '' };

async function runImageBatch(ids) {
  imageBatch.running = true;
  imageBatch.total = ids.length;
  imageBatch.done = 0;
  imageBatch.ok = 0;
  imageBatch.failed = 0;
  imageBatch.results = [];
  imageBatch.errors = [];
  imageBatch.started_at = nowIso();
  imageBatch.finished_at = '';

  for (const id of ids) {
    imageBatch.current = '#' + id;
    try {
      const c = get('select * from content where id = ?', id);
      if (!c) throw new Error('内容不存在');
      const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;

      let prompt = '';
      let negative = '';
      let ratio = '4:5';
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
        const o = jsonObjectsIn(r.content).reverse().find((x) => x && x.prompt) || {};
        prompt = o.prompt || ('commercial product photography of ' + (product?.name || 'custom packaging') + ', clean studio, soft light, no text');
        negative = o.negative || '';
      }

      const [w, h] = ratio.split(':').map(Number);
      const base = 1024;
      const width = w && h ? Math.round(base * (w / Math.max(w, h))) : 832;
      const height = w && h ? Math.round(base * (h / Math.max(w, h))) : 1024;

      const cfg = imageApiCfg();
      const out = cfg
        ? await generateImageExternal({ prompt, size: Math.max(width, height) + 'x' + Math.max(width, height) })
        : await generateImage({ prompt, negative, width, height });

      run('update content set image_path = ?, image_alt = ?, image_prompt = ? where id = ?',
        out.file, prompt.slice(0, 300), JSON.stringify({ prompt, negative, ratio }), id);
      imageBatch.ok++;
      imageBatch.results.push({ id, url: out.url, model: out.model });
    } catch (e) {
      imageBatch.failed++;
      imageBatch.errors.push({ id, error: e.message });
    }
    imageBatch.done++;
  }
  imageBatch.running = false;
  imageBatch.current = '';
  imageBatch.finished_at = nowIso();
  audit('content.batch_image', String(ids.length), { ok: imageBatch.ok, failed: imageBatch.failed });
}

on('POST', /^\\/api\\/images\\/batch$/, async (m, b) => {
  if (imageBatch.running) return { started: false, reason: '上一批还在跑', progress: imageBatch };
  const limit = Math.min(Number(b.limit) || 10, 20);
  const rows = b.ids
    ? all(\`select id from content where id in (\${b.ids.map(() => '?').join(',')})\`, ...b.ids.map(Number))
    : all("select id from content where status in ('pending_review','approved','draft') and (image_path is null or image_path = '') order by id desc limit ?", limit);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { started: false, reason: '没有需要出图的稿子' };
  runImageBatch(ids).catch(() => {});
  return { started: true, total: ids.length, ids };
});

on('GET', /^\\/api\\/images\\/batch$/, async () => imageBatch);

/* ---------- 配图提示词`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: batch image endpoints added');
}

/* ---------- UI：审核页批量配图按钮 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('data-batch-img')) {
  a = a.replace(
    '<div class="panel-head"><h2>待审 · ${contents.length}</h2><span class="hint">含价格/承诺/认证/案例/联系方式的稿子必须人工点通过</span></div>',
    '<div class="panel-head"><h2>待审 · ${contents.length}</h2><div class="row tight"><span class="hint">含价格/承诺/认证/案例/联系方式的稿子必须人工点通过</span><button class="btn ghost tiny" data-batch-img>批量配图</button></div></div>\n      <div id="batch-out" class="muted" style="font-size:12.5px;margin-bottom:8px"></div>'
  );

  a = a.replace(
    "  $$('[data-genimg]').forEach((b) => (b.onclick = async (ev) => {",
    `  const batchBtn = $('[data-batch-img]');
  if (batchBtn) batchBtn.onclick = async () => {
    batchBtn.disabled = true;
    const out = $('#batch-out');
    out.textContent = '启动中…';
    try {
      const r = await api('/api/images/batch', 'POST', { limit: 10 });
      if (!r.started) { out.textContent = r.reason || '没启动'; batchBtn.disabled = false; return; }
      out.textContent = '批量出图中：0/' + r.total;
      const timer = setInterval(async () => {
        const p = await api('/api/images/batch');
        out.textContent = '批量出图：' + p.done + '/' + p.total + ' · 成功 ' + p.ok + ' · 失败 ' + p.failed + (p.current ? ' · 当前 ' + p.current : '');
        if (!p.running) {
          clearInterval(timer);
          batchBtn.disabled = false;
          out.textContent = '批量出图完成：成功 ' + p.ok + ' · 失败 ' + p.failed + (p.errors.length ? '（' + p.errors.map((e) => '#' + e.id).join(',') + '）' : '');
          setTimeout(viewReview, 1200);
        }
      }, 4000);
    } catch (e) { out.textContent = e.message; batchBtn.disabled = false; }
  };
  $$('[data-genimg]').forEach((b) => (b.onclick = async (ev) => {`
  );

  writeFileSync(ap, a, 'utf8');
  console.log('ui: batch image button added');
}
