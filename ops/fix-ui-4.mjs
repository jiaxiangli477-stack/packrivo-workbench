import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- app.js ---------- */
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* 1) 产品表单提示：去掉 7 天出样 与旧卖点话术 */
rep('product-placeholder',
  'placeholder="一张纸成型 / 无需胶带 / CMYK 定制 / MOQ 500 / 7 天出样"',
  'placeholder="只写网站上已公开的卖点；尺寸克重没写的留空，别让 AI 编"');

rep('product-params-placeholder',
  'placeholder="尺寸、克重、材质、交期"',
  'placeholder="网站已公开的参数才填；没有就留空（交期只能写 1–15 days）"');

/* 2) 模型下拉去重：同名去掉 provider 后缀那一条；zen/kilo 免费变体只留一条 */
rep('models-dedupe-settings',
  "      const models = (builtin.models || []).filter((m) => !m.startsWith('route/'));",
  "      const norm = (m) => String(m).replace(/\\s*·.*$/, '').replace(/^zen\\//, '').replace(/^kilo\\/.*$/, '').trim().toLowerCase();\n" +
  "      const seen = new Set();\n" +
  "      const models = (builtin.models || [])\n" +
  "        .filter((m) => !String(m).startsWith('route/'))\n" +
  "        .filter((m) => {\n" +
  "          const k = norm(m);\n" +
  "          if (!k || seen.has(k)) return false;\n" +
  "          seen.add(k);\n" +
  "          return true;\n" +
  "        })\n" +
  "        .sort((a, b) => (String(a).includes('·') ? 1 : 0) - (String(b).includes('·') ? 1 : 0));");

/* 3) 模型接入页：chip 也去重 */
rep('models-dedupe-page',
  '<div class="pill-list" style="margin-top:8px">${(builtin.models || []).slice(0, 8).map((m) => `<span class="tag mute">${esc(m)}</span>`).join(\'\')}</div>',
  '${(() => {\n' +
  '        const norm = (m) => String(m).replace(/\\s*·.*$/, \'\').replace(/^zen\\//, \'\').replace(/^kilo\\/.*$/, \'\').trim().toLowerCase();\n' +
  '        const seen = new Set();\n' +
  '        const uniq = (builtin.models || []).filter((m) => { const k = norm(m); if (!k || seen.has(k)) return false; seen.add(k); return true; });\n' +
  '        return `<div class="pill-list" style="margin-top:8px">${uniq.slice(0, 8).map((m) => `<span class="tag mute">${esc(m)}</span>`).join("")}</div>`;\n' +
  '      })()}');

writeFileSync(p, c, 'utf8');
console.log('app done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));

/* ---------- CSS：字号整体上调 ---------- */
const cp = 'E:/破甲工作区/social-workbench/web/style.css';
let css = readFileSync(cp, 'utf8');
const cd = [];
const crep = (n, a, b) => { if (!css.includes(a)) { console.log('CSS MISS:', n); return; } css = css.replace(a, b); cd.push(n); };

crep('base-font', 'font: 14px/1.65 "Segoe UI"', 'font: 15px/1.7 "Segoe UI"');
crep('nav-font', 'border-radius: 9px; cursor: pointer; text-align: left; font-size: 13px;', 'border-radius: 9px; cursor: pointer; text-align: left; font-size: 14px;');
crep('hint', '.panel-head .hint { color: var(--muted); font-size: 12.5px; }', '.panel-head .hint { color: var(--muted); font-size: 13px; }');
crep('tag', 'font-size: 12px;', 'font-size: 12.5px;');
crep('table', 'table { width: 100%; border-collapse: collapse; font-size: 13px; }', 'table { width: 100%; border-collapse: collapse; font-size: 13.5px; }');
crep('kpi-k', '.kpi .k { color: var(--muted); font-size: 11.5px;', '.kpi .k { color: var(--muted); font-size: 13px;');
crep('kpi-s', '.kpi .s { color: var(--muted); font-size: 11.5px;', '.kpi .s { color: var(--muted); font-size: 12.5px;');
crep('panel-h2', '.panel-head h2 { margin: 0; font-size: 13.5px;', '.panel-head h2 { margin: 0; font-size: 15px;');
crep('nav-label', '.nav-label { color: #55637a; font-size: 10.5px;', '.nav-label { color: #6b7b93; font-size: 12px;');
crep('media-title', '.media-card .title { font-size: 13px;', '.media-card .title { font-size: 14px;');
crep('media-meta', '.media-card .meta { color: var(--muted); font-size: 11.5px;', '.media-card .meta { color: var(--muted); font-size: 12.5px;');
crep('input', 'padding: 8px 10px; border-radius: 9px; width: 100%; font-size: 12.5px;', 'padding: 9px 11px; border-radius: 9px; width: 100%; font-size: 14px;');
crep('field-label', '.field > label { color: var(--muted); font-size: 11.5px; }', '.field > label { color: var(--muted); font-size: 13px; }');
crep('pre', '.pre { white-space: pre-wrap; background: #0a0f17; border: 1px solid var(--line); border-radius: 10px; padding: 12px; font-size: 12.5px;', '.pre { white-space: pre-wrap; background: #0a0f17; border: 1px solid var(--line); border-radius: 10px; padding: 12px; font-size: 13.5px;');

writeFileSync(cp, css, 'utf8');
console.log('css done:', cd.join(', '));
