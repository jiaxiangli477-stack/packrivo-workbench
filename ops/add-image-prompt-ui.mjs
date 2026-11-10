import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(p, 'utf8');
const done = [];
const rep = (n, x, y) => { if (!a.includes(x)) { console.log('MISS', n); return; } a = a.replace(x, y); done.push(n); };

/* 博客转社媒结果表：加配图列 */
rep('blog-result-col',
  "'<table style=\"margin-top:10px\"><thead><tr><th>#</th><th>平台</th><th>状态</th></tr></thead><tbody>' + r.created.map((x) => '<tr><td class=\"mono\">' + x.id + '</td><td>' + esc(pname(x.platform)) + '</td><td><span class=\"tag warn\">待审核</span></td></tr>').join('') + '</tbody></table>' +",
  "'<table style=\"margin-top:10px\"><thead><tr><th>#</th><th>平台</th><th>状态</th><th>配图</th></tr></thead><tbody>' + r.created.map((x) => '<tr><td class=\"mono\">' + x.id + '</td><td>' + esc(pname(x.platform)) + '</td><td><span class=\"tag warn\">待审核</span></td><td><button class=\"btn ghost tiny\" data-imgprompt=\"' + x.id + '\">生成提示词</button></td></tr>').join('') + '</tbody></table>' +");

/* AI 二创生成结果表：加配图列 */
rep('gen-result-col',
  '          <td class="muted">${esc(c.via)}</td></tr>`).join(\'\')}',
  '          <td class="muted">${esc(c.via)}</td>\n          <td><button class="btn ghost tiny" data-imgprompt="${c.id}">配图提示词</button></td></tr>`).join(\'\')}');
rep('gen-result-head',
  '<table><thead><tr><th>#</th><th>平台</th><th>相似度</th><th>模型</th></tr></thead><tbody>',
  '<table><thead><tr><th>#</th><th>平台</th><th>相似度</th><th>模型</th><th>配图</th></tr></thead><tbody>');

/* 审核队列：加配图按钮 */
rep('review-btn',
  '<button class="btn ghost tiny" data-ok="${c.id}">通过</button>',
  '<button class="btn ghost tiny" data-imgprompt="${c.id}">配图提示词</button>\n      <button class="btn ghost tiny" data-ok="${c.id}">通过</button>');

/* 绑定：插在 AI 预审绑定之前 */
rep('bind',
  "  $$('[data-ai]').forEach((b) => (b.onclick = async () => {",
  "  $$('[data-imgprompt]').forEach((b) => (b.onclick = async () => {\n" +
  "    const id = b.dataset.imgprompt;\n" +
  "    const old = b.textContent;\n" +
  "    b.disabled = true; b.textContent = '生成中…';\n" +
  "    try {\n" +
  "      const r = await api('/api/contents/' + id + '/image-prompt', 'POST', {});\n" +
  "      const txt = 'PROMPT: ' + r.prompt + '\\n\\nNEGATIVE: ' + (r.negative || '-') + '\\nRATIO: ' + r.ratio + '\\n用途: ' + (r.alt || '');\n" +
  "      const box = document.createElement('div');\n" +
  "      box.className = 'panel';\n" +
  "      box.style.cssText = 'margin-top:10px;border-color:#2b4a7a';\n" +
  "      box.innerHTML = '<div class=\"panel-head\"><h2>配图提示词 · 内容 #' + id + '</h2><span class=\"hint\">复制到 Midjourney / SD / 即梦 出图</span></div><pre class=\"pre\" style=\"white-space:pre-wrap\">' + esc(txt) + '</pre>';\n" +
  "      const row = document.createElement('div');\n" +
  "      row.className = 'row'; row.style.marginTop = '8px';\n" +
  "      const cp = document.createElement('button');\n" +
  "      cp.className = 'btn tiny'; cp.textContent = '复制';\n" +
  "      cp.onclick = () => { navigator.clipboard.writeText(txt); toast('已复制'); };\n" +
  "      row.appendChild(cp); box.appendChild(row);\n" +
  "      b.closest('.panel') ? b.closest('.panel').appendChild(box) : document.querySelector('#content').appendChild(box);\n" +
  "      toast('提示词已生成');\n" +
  "    } catch (e) { toast(e.message, true); }\n" +
  "    b.disabled = false; b.textContent = old;\n" +
  "  }));\n" +
  "  $$('[data-ai]').forEach((b) => (b.onclick = async () => {");

writeFileSync(p, a, 'utf8');
console.log('done:', done.join(', '));
