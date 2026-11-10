import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- db: content.image_prompt ---------- */
const dp = 'E:/破甲工作区/social-workbench/app/db.mjs';
let d = readFileSync(dp, 'utf8');
if (!d.includes('image_prompt')) {
  d = d.replace(
    "  utm_url text,",
    "  utm_url text,\n  image_prompt text,"
  );
  d = d.replace(
    "/* 老库补列：metric.inquiries */",
    "/* 老库补列：content.image_prompt */\n{\n  const cols = db.prepare('PRAGMA table_info(content)').all().map((c) => c.name);\n  if (!cols.includes('image_prompt')) db.exec('alter table content add column image_prompt text');\n}\n\n/* 老库补列：metric.inquiries */"
  );
  writeFileSync(dp, d, 'utf8');
  console.log('db: image_prompt added');
}

/* ---------- server: 配图提示词 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/image-prompt')) {
  s = s.replace(
    "/* ---------- 博客转社媒 ---------- */",
    `/* ---------- 配图提示词（本机未接图像模型，先产出可直接粘贴的英文 prompt） ---------- */
on('POST', /^\\/api\\/contents\\/(\\d+)\\/image-prompt$/, async (m, b) => {
  const id = Number(m[1]);
  const c = get('select c.*, p.name as pname, p.selling_points as ppoints from content c left join product p on p.id = c.product_id where c.id = ?', id);
  if (!c) throw new Error('内容不存在');
  const ratio = b.ratio || '4:5';
  const prompt = \`为这条 \${c.platform} 帖子写一段英文出图提示词（给 Midjourney / SD / 即梦用）。
帖子标题：\${c.title}
正文：\${String(c.body || '').slice(0, 600)}
产品：\${c.pname || '(未关联)'} \${String(c.ppoints || '').slice(0, 200)}
要求：商业产品摄影，首饰/蜡烛/礼盒场景，干净背景，自然光，无文字、无 logo、无水印，画面留出放文案的空间，比例 \${ratio}。
输出 JSON：{"prompt":"英文提示词，逗号分隔，60-90词","negative":"英文反向词","ratio":"\${ratio}","alt":"一句中文说明这张图要表达什么"}\`;
  const r = await chat({ task: 'analyze', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.6, maxTokens: 1000 });
  const obj = extractJson(r.content, ['prompt']) || { prompt: String(r.content || '').slice(0, 600), negative: '', ratio, alt: '' };
  run('update content set image_prompt = ? where id = ?', JSON.stringify(obj), id);
  audit('content.image_prompt', String(id), { ratio });
  return { ok: true, ...obj };
});

/* ---------- 博客转社媒 ---------- */`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: image-prompt route added');
}

/* ---------- app.js: 按钮 + 展示 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
const done = [];
const rep = (n, x, y) => { if (!a.includes(x)) { console.log('MISS', n); return; } a = a.replace(x, y); done.push(n); };

/* 生成结果表格加一列按钮 */
rep('gen-result-btn',
  "'<td><span class=\"tag warn\">待审核</span></td></tr>'",
  "'<td><span class=\"tag warn\">待审核</span></td><td><button class=\"btn ghost tiny\" data-imgprompt=\"' + x.id + '\">配图提示词</button></td></tr>'");

/* 审核队列加按钮 */
rep('review-btn',
  '<td class="row"><button class="btn ghost tiny" data-pass="${c.id}">通过</button>',
  '<td class="row"><button class="btn ghost tiny" data-imgprompt="${c.id}">配图</button><button class="btn ghost tiny" data-pass="${c.id}">通过</button>');

/* 绑定 */
rep('bind-imgprompt',
  "  $$('[data-pass]').forEach((b) => (b.onclick = async () => {",
  "  $$('[data-imgprompt]').forEach((b) => (b.onclick = async () => {\n" +
  "    const id = b.dataset.imgprompt;\n" +
  "    b.disabled = true; b.textContent = '生成中…';\n" +
  "    try {\n" +
  "      const r = await api('/api/contents/' + id + '/image-prompt', 'POST', {});\n" +
  "      const txt = 'PROMPT: ' + r.prompt + '\\n\\nNEGATIVE: ' + (r.negative || '-') + '\\nRATIO: ' + r.ratio + '\\n用途: ' + (r.alt || '');\n" +
  "      const box = document.createElement('div');\n" +
  "      box.className = 'panel';\n" +
  "      box.style.cssText = 'margin-top:10px;border-color:#2b4a7a';\n" +
  "      box.innerHTML = '<div class=\"panel-head\"><h2>配图提示词 #' + id + '</h2><span class=\"hint\">复制到 Midjourney / SD / 即梦 即可出图</span></div><pre class=\"pre\" style=\"white-space:pre-wrap\">' + esc(txt) + '</pre><div class=\"row\" style=\"margin-top:8px\"><button class=\"btn tiny\" id=\"copy-' + id + '\">复制</button></div>';\n" +
  "      b.parentElement.parentElement.parentElement.appendChild(box);\n" +
  "      const cp = box.querySelector('#copy-' + id);\n" +
  "      if (cp) cp.onclick = () => { navigator.clipboard.writeText(txt); toast('已复制'); };\n" +
  "      toast('提示词已生成');\n" +
  "    } catch (e) { toast(e.message, true); }\n" +
  "    b.disabled = false; b.textContent = '配图提示词';\n" +
  "  }));\n" +
  "  $$('[data-pass]').forEach((b) => (b.onclick = async () => {");

writeFileSync(ap, a, 'utf8');
console.log('app done:', done.join(', '));
