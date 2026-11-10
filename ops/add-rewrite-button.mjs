import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: 按建议重写 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/rewrite-from-analysis')) {
  s = s.replace(
    '/* ---------- 配图提示词',
    `/* 按 AI 分析建议重写：生成新版本（parent_id 指向原稿），原文保留 */
on('POST', /^\\/api\\/contents\\/(\\d+)\\/rewrite-from-analysis$/, async (m) => {
  const id = Number(m[1]);
  const c = get('select * from content where id = ?', id);
  if (!c) throw new Error('内容不存在');

  const row = get("select payload from ai_analysis where target_kind = 'content' and target_id = ? order by id desc limit 1", id);
  if (!row) throw new Error('这条还没做过 AI 分析，先点「AI 分析」');
  let a = {};
  try { a = JSON.parse(row.payload); } catch {}

  const issues = [...(a.seo?.issues || []), ...(a.geo?.issues || [])].slice(0, 10);
  const fixes = [...(a.seo?.fixes || []), ...(a.geo?.fixes || [])].slice(0, 10);
  const product = c.product_id ? get('select * from product where id = ?', c.product_id) : null;
  const policy = get('select * from platform_tag_policy where platform = ?', c.platform) || { text_limit: 600 };
  const limit = Math.min(250, policy.text_limit || 600);

  const prompt = \`重写这条 \${c.platform} 帖子，逐条修掉下面的问题；原有事实必须保留，不得新增价格、交期、认证、客户案例。
原文：
\${c.body}

要修的问题：
\${issues.map((x, i) => (i + 1) + '. ' + x).join('\\n') || '(无)'}

建议改法：
\${fixes.map((x, i) => (i + 1) + '. ' + x).join('\\n') || '(无)'}

\${product ? \`产品：\${product.name}（\${product.sku}）；卖点：\${product.selling_points}\` : ''}
字数：正文 ≤ \${limit} 字符；标题是一句钩子；正文不要放链接（链接走卡片）。
\${kbContext(1500)}
输出 JSON：{"title":"...","body":"...","hashtags":"..."}\`;

  let obj = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2000 });
    const o = extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }
  }
  if (!obj) throw new Error('模型两次都没给出可用正文，稍后重试');

  const ins = run(
    'insert into content(product_id, parent_id, platform, lang, title, body, hashtags, status, model) values (?,?,?,?,?,?,?,?,?)',
    c.product_id, c.id, c.platform, c.lang, obj.title || c.title, obj.body, pickTags(c.platform, obj.hashtags || ''), 'pending_review', 'rewrite-by-analysis'
  );
  const newId = Number(ins.lastInsertRowid);
  if (product && product.image_path) {
    run('update content set image_path = ?, image_alt = ? where id = ?', product.image_path, product.image_alt || product.name, newId);
  }
  audit('content.rewrite', String(id), { new_id: newId, issues: issues.length });
  return { ok: true, id: newId, title: obj.title, body: obj.body, chars: String(obj.body).length, issues: issues.length };
});

/* ---------- 配图提示词`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: rewrite-from-analysis added');
}

/* ---------- UI：分析区加按钮 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(ap, 'utf8');
if (!c.includes('data-rewrite')) {
  c = c.replace(
    `      box.innerHTML = '<div class="panel" style="background:var(--surface-2);margin-top:10px"><div class="panel-head"><h2>AI 分析 · SEO / GEO</h2><span class="hint">' + esc(r.via || '') + '</span></div>' + renderSeoGeo(r.analysis) + '</div>';`,
    `      box.innerHTML = '<div class="panel" style="background:var(--surface-2);margin-top:10px"><div class="panel-head"><h2>AI 分析 · SEO / GEO</h2><div class="row tight"><span class="hint">' + esc(r.via || '') + '</span><button class="btn tiny" data-rewrite="' + b.dataset.anlc + '">按建议重写</button></div></div>' + renderSeoGeo(r.analysis) + '</div>';
      bindRewrite();`
  );

  c = c.replace(
    "  $$('[data-ok]').forEach((b) => (b.onclick = async (ev) => {",
    `  function bindRewrite() {
    $$('[data-rewrite]').forEach((btn) => (btn.onclick = async () => {
      const id = btn.dataset.rewrite;
      btn.disabled = true; btn.textContent = '重写中…';
      try {
        const r = await api('/api/contents/' + id + '/rewrite-from-analysis', 'POST', {});
        toast('已按建议重写：新稿 #' + r.id + '（' + r.chars + ' 字符）');
        setTimeout(viewReview, 1200);
      } catch (e) { toast(e.message, true); }
      btn.disabled = false; btn.textContent = '按建议重写';
    }));
  }
  $$('[data-ok]').forEach((b) => (b.onclick = async (ev) => {`
  );

  writeFileSync(ap, c, 'utf8');
  console.log('ui: rewrite button added');
}
