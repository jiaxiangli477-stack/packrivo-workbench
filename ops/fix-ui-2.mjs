import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* ---- 设置页：敏感闸门改开关 ---- */
rep('sens-switch',
  "${f('review_sensitive_enabled', '敏感项闸门（1 开 / 0 关）')}",
  '<div class="field"><label>敏感项人工闸门</label><button class="btn ' + '"' + ' id="s-sens-toggle">状态加载中</button></div>');

/* ---- 设置页：模型映射改下拉框 ---- */
rep('model-selects',
  '<div class="panel-head"><h2>模型映射</h2><span class="hint">任务 → 模型名，改完立即生效</span></div>\n      <div class="field"><label>llm_task_models（JSON）</label><textarea id="s-llm_task_models">${esc(settings.llm_task_models)}</textarea></div>',
  '<div class="panel-head"><h2>模型映射</h2><span class="hint">每个任务用一个下拉框选模型</span></div>\n' +
  '      <div class="grid g3" id="s-task-models"></div>\n' +
  '      <details style="margin-top:12px"><summary class="muted" style="cursor:pointer;font-size:12px">高级：直接编辑 JSON</summary>\n' +
  '        <div class="field" style="margin-top:8px"><textarea id="s-llm_task_models">${esc(settings.llm_task_models)}</textarea></div></details>');

/* ---- 设置页：保存逻辑 ---- */
rep('settings-save',
  "    const keys = ['publish_mode', 'publish_channel_default', 'public_base_url', 'review_sensitive_enabled', 'review_sensitive_extra', 'weekly_quota', 'brand_tone', 'primary_lang', 'market', 'webhook_url', 'postiz_base', 'video_api_path', 'apify_token', 'apify_actor', 'llm_task_models'];\n    const body = {};\n    for (const k of keys) { const el = $('#s-' + k); if (el) body[k] = el.value; }\n    try { await api('/api/settings', 'PUT', body); toast('已保存'); }\n    catch (e) { toast(e.message, true); }",
  "    const keys = ['publish_mode', 'publish_channel_default', 'public_base_url', 'review_sensitive_extra', 'weekly_quota', 'brand_tone', 'primary_lang', 'market', 'webhook_url', 'postiz_base', 'video_api_path', 'apify_token', 'apify_actor'];\n" +
  "    const body = {};\n" +
  "    for (const k of keys) { const el = $('#s-' + k); if (el) body[k] = el.value; }\n" +
  "    body.review_sensitive_enabled = ST.sensOn ? '1' : '0';\n" +
  "    const map = {};\n" +
  "    $$('#s-task-models select').forEach((sel) => { if (sel.dataset.task) map[sel.dataset.task] = sel.value; });\n" +
  "    body.llm_task_models = JSON.stringify(map);\n" +
  "    if (body.publish_mode === 'auto' && !confirm('切到 auto 后，AI 审核通过的内容会直接发到真实账号（敏感项仍会拦）。确定吗？')) return;\n" +
  "    try { await api('/api/settings', 'PUT', body); toast('已保存'); }\n" +
  "    catch (e) { toast(e.message, true); }");

/* ---- 设置页初始化：开关状态 + 下拉填充 ---- */
rep('settings-init',
  "  $('#s-save').onclick = async () => {",
  "  ST.sensOn = String(settings.review_sensitive_enabled) === '1';\n" +
  "  const sensBtn = $('#s-sens-toggle');\n" +
  "  const paintSens = () => { if (!sensBtn) return; sensBtn.textContent = ST.sensOn ? '已开启（命中就转人工）' : '已关闭'; sensBtn.className = 'btn ' + (ST.sensOn ? 'primary' : 'ghost'); };\n" +
  "  paintSens();\n" +
  "  if (sensBtn) sensBtn.onclick = () => { ST.sensOn = !ST.sensOn; paintSens(); };\n" +
  "  (async () => {\n" +
  "    try {\n" +
  "      const { builtin } = await api('/api/models');\n" +
  "      const models = (builtin.models || []).filter((m) => !m.startsWith('route/'));\n" +
  "      let map = {};\n" +
  "      try { map = JSON.parse(settings.llm_task_models || '{}'); } catch {}\n" +
  "      const tasks = [['deconstruct', '爆款拆解'], ['rewrite', '文案改写'], ['review', '审核预审'], ['analyze', 'SEO/GEO 分析'], ['audit', 'kimi 质检'], ['report', '报告撰写']];\n" +
  "      const box = $('#s-task-models');\n" +
  "      if (box) box.innerHTML = tasks.map(([k, label]) => '<div class=\"field\"><label>' + label + '</label><select data-task=\"' + k + '\">' + models.map((m) => '<option ' + (map[k] === m ? 'selected' : '') + '>' + esc(m) + '</option>').join('') + '</select></div>').join('');\n" +
  "    } catch {}\n" +
  "  })();\n" +
  "  $('#s-save').onclick = async () => {");

/* ---- 模型接入页：默认只显示在用模型 ---- */
rep('models-fold',
  '<div class="pill-list" style="margin-top:8px">${(builtin.models || []).slice(0, 16).map((m) => `<span class="tag mute">${esc(m)}</span>`).join(\'\')}</div>',
  '<div class="pill-list" style="margin-top:8px">${(builtin.models || []).slice(0, 8).map((m) => `<span class="tag mute">${esc(m)}</span>`).join(\'\')}</div>\n      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer;font-size:12px">展开全部 ${(builtin.models || []).length} 个模型</summary>\n        <div class="pill-list" style="margin-top:8px">${(builtin.models || []).map((m) => `<span class="tag mute">${esc(m)}</span>`).join(\'\')}</div></details>');

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
