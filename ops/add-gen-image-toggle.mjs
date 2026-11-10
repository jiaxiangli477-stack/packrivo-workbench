import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: generate 支持顺带出图 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

rep('gen-image-flag',
  "  const created = [];\n  const errors = [];",
  "  const created = [];\n  const errors = [];\n  const wantImage = b.gen_image === true || b.gen_image === '1';");

rep('gen-kick-batch',
  "  return { ok: created.length > 0, created, errors };",
  `  if (wantImage && created.length) {
    runImageBatch(created.map((x) => x.id)).catch(() => {});
  }
  return { ok: created.length > 0, created, errors, image_batch: wantImage };`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));

/* ---------- UI: 生成表单加两个勾选 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('id="g-genimg"')) {
  a = a.replace(
    '<button class="btn primary" id="g-run">生成</button>',
    `<div class="pill-list" style="margin-top:10px">
          <label class="tag info" style="cursor:pointer"><input type="checkbox" id="g-genimg" checked style="width:auto;margin-right:6px;vertical-align:middle" />同时生成配图（外部图像 API）</label>
          <label class="tag mute" style="cursor:pointer;opacity:.7" title="需要先配置视频接口（可灵/即梦/Veo）"><input type="checkbox" id="g-genvid" disabled style="width:auto;margin-right:6px;vertical-align:middle" />同时生成短视频（未接）</label>
        </div>
        <button class="btn primary" id="g-run" style="margin-top:10px">生成</button>`
  );

  a = a.replace(
    "      const r = await api('/api/content/generate', 'POST', { product_id: Number($('#g-prod').value), platforms, lang: $('#g-lang').value, tone: $('#g-tone').value, hotspot_id: ST.presetHotspot || null });",
    `      const genImg = $('#g-genimg') && $('#g-genimg').checked;
      const r = await api('/api/content/generate', 'POST', { product_id: Number($('#g-prod').value), platforms, lang: $('#g-lang').value, tone: $('#g-tone').value, hotspot_id: ST.presetHotspot || null, gen_image: genImg });`
  );

  writeFileSync(ap, a, 'utf8');
  console.log('ui: toggles added');
} else console.log('ui already');
