import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- app.js: 博客转社媒面板 ---------- */
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

rep('blog-panel',
  '<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>生成结果</h2></div><div id="g-out" class="empty">还没生成</div></div>`;',
  '<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>生成结果</h2></div><div id="g-out" class="empty">还没生成</div></div>\n' +
  '\n' +
  '    <div class="panel" style="margin-top:14px">\n' +
  '      <div class="panel-head"><h2>博客转社媒</h2><span class="hint">贴一篇 packrivo.com 博客链接，读标题与要点，生成 3-5 条不同平台的帖子</span></div>\n' +
  '      <div class="row">\n' +
  '        <div class="field" style="flex:2;min-width:320px"><label>博客链接</label><input id="b-url" placeholder="https://www.packrivo.com/blog/..." /></div>\n' +
  '        <button class="btn primary" id="b-run">读取并生成</button>\n' +
  '        <span class="muted" id="b-status"></span>\n' +
  '      </div>\n' +
  '      <div class="pill-list" style="margin-top:10px">\n' +
  '        ${[["facebook_page","Facebook 主页"],["instagram","Instagram"],["tiktok","TikTok"],["pinterest","Pinterest"],["linkedin","LinkedIn"]].map((x, i) => `<label class="tag info" style="cursor:pointer"><input type="checkbox" class="b-plat" value="${x[0]}" ${i < 3 ? "checked" : ""} style="width:auto;margin-right:6px;vertical-align:middle" />${x[1]}</label>`).join("")}\n' +
  '      </div>\n' +
  '      <div id="b-out" style="margin-top:12px"></div>\n' +
  '    </div>`;');

rep('blog-handler',
  "  if (ST.presetHotspot) {",
  "  const bRun = $('#b-run');\n" +
  "  if (bRun) bRun.onclick = async () => {\n" +
  "    const url = $('#b-url').value.trim();\n" +
  "    if (!url) return toast('先贴博客链接', true);\n" +
  "    const plats = $$('.b-plat').filter((x) => x.checked).map((x) => x.value);\n" +
  "    if (!plats.length) return toast('至少选一个平台', true);\n" +
  "    bRun.disabled = true; $('#b-status').textContent = '读取博客 → 生成中…（每个平台一次模型调用）';\n" +
  "    try {\n" +
  "      const r = await api('/api/blog/import', 'POST', { url, platforms: plats });\n" +
  "      $('#b-out').innerHTML = '<div class=\"tag ok\">已生成 ' + r.created.length + ' 条</div><div class=\"muted\" style=\"margin-top:6px\">来源：《' + esc(r.source.title) + '》 · 小标题 ' + r.source.headings.length + ' 个 · 要点段落 ' + r.source.paragraphs + ' 段</div>' +\n" +
  "        '<table style=\"margin-top:10px\"><thead><tr><th>#</th><th>平台</th><th>状态</th></tr></thead><tbody>' + r.created.map((x) => '<tr><td class=\"mono\">' + x.id + '</td><td>' + esc(pname(x.platform)) + '</td><td><span class=\"tag warn\">待审核</span></td></tr>').join('') + '</tbody></table>' +\n" +
  "        (r.errors.length ? '<div class=\"tag bad\" style=\"margin-top:8px\">失败：' + r.errors.map((e) => esc(e.platform + ': ' + e.error)).join('；') + '</div>' : '');\n" +
  "      toast('已生成 ' + r.created.length + ' 条，进审核队列');\n" +
  "    } catch (e) { toast(e.message, true); }\n" +
  "    bRun.disabled = false; $('#b-status').textContent = '';\n" +
  "  };\n" +
  "  if (ST.presetHotspot) {");

writeFileSync(p, c, 'utf8');
console.log('app done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));

/* ---------- CSS：字号与对比度 ---------- */
const cp = 'E:/破甲工作区/social-workbench/web/style.css';
let css = readFileSync(cp, 'utf8');
const cdone = [];
const crep = (n, a, b) => { if (!css.includes(a)) { console.log('CSS MISS:', n); return; } css = css.replace(a, b); cdone.push(n); };
crep('body-size', 'font: 13.5px/1.62 "Segoe UI"', 'font: 14px/1.65 "Segoe UI"');
crep('muted-dark', '--muted: #6f7f97;', '--muted: #93a2b8;');
crep('muted-light', '  --muted: #64748b;', '  --muted: #5b6b80;');
crep('hint-size', '.panel-head .hint { color: var(--muted); font-size: 11.5px; }', '.panel-head .hint { color: var(--muted); font-size: 12.5px; }');
crep('tag-size', '.tag { display: inline-flex; align-items: center; gap: 5px; padding: 1px 9px; border-radius: 999px; font-size: 11.5px;', '.tag { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 12px;');
crep('table-size', 'table { width: 100%; border-collapse: collapse; font-size: 12.5px; }', 'table { width: 100%; border-collapse: collapse; font-size: 13px; }');
writeFileSync(cp, css, 'utf8');
console.log('css done:', cdone.join(', '));
