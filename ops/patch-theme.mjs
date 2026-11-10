import { readFileSync, writeFileSync } from 'node:fs';

// 1) fix bluesky call (PowerShell mangled the template literal)
const rp = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let rad = readFileSync(rp, 'utf8');
rad = rad.replace("posts.push(...(await searchBluesky(${seed} packaging, 5)))", "posts.push(...(await searchBluesky(`${seed} packaging`, 5)))");
writeFileSync(rp, rad, 'utf8');
console.log('radar fixed, has template:', rad.includes('searchBluesky(`${seed} packaging`, 5)'));

// 2) theme toggle in index.html
const ip = 'E:/破甲工作区/social-workbench/web/index.html';
let html = readFileSync(ip, 'utf8');
if (!html.includes('btn-theme')) {
  html = html.replace(
    '<button class="btn ghost" id="btn-tick">跑一轮队列</button>',
    '<button class="btn ghost" id="btn-theme">浅色</button>\n        <button class="btn ghost" id="btn-tick">跑一轮队列</button>'
  );
  writeFileSync(ip, html, 'utf8');
}
console.log('theme button:', html.includes('btn-theme'));

// 3) light theme CSS
const cp = 'E:/破甲工作区/social-workbench/web/style.css';
let css = readFileSync(cp, 'utf8');
if (!css.includes('[data-theme="light"]')) {
  css += `

/* ---------- 浅色主题 ---------- */
html[data-theme="light"] {
  --bg: #f4f6fa;
  --bg-soft: #eef2f8;
  --surface: #ffffff;
  --surface-2: #f6f8fc;
  --surface-3: #eef3fa;
  --line: #dbe3ee;
  --line-soft: #e8eef7;
  --text: #0f172a;
  --text-dim: #33415a;
  --muted: #64748b;
  --shadow: 0 1px 0 rgba(15,23,42,.03) inset, 0 8px 24px -18px rgba(15,23,42,.35);
}
html[data-theme="light"] body {
  background:
    radial-gradient(900px 500px at 10% -10%, rgba(79,140,255,.10), transparent 60%),
    radial-gradient(800px 420px at 100% 0%, rgba(124,92,255,.08), transparent 55%),
    var(--bg);
}
html[data-theme="light"] .rail {
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(246,249,253,.98));
}
html[data-theme="light"] .topbar { background: rgba(255,255,255,.86); }
html[data-theme="light"] input,
html[data-theme="light"] select,
html[data-theme="light"] textarea { background: #fff; color: var(--text); }
html[data-theme="light"] .pre { background: #f8fafc; }
html[data-theme="light"] thead th { background: var(--surface); }
html[data-theme="light"] tbody tr:hover td { background: rgba(15,23,42,.025); }
html[data-theme="light"] .media-card .thumb { background-color: #eef2f8; }
html[data-theme="light"] .subnav { background: var(--surface); }
html[data-theme="light"] .media-card .thumb .score,
html[data-theme="light"] .media-card .thumb .plat { background: rgba(255,255,255,.9); color: var(--text-dim); }
html[data-theme="light"] .toast { background: #ffffff; color: var(--text); }
html[data-theme="light"] nav button.on { background: linear-gradient(90deg, rgba(79,140,255,.16), rgba(79,140,255,.03)); color: #1d4ed8; }
`;
  writeFileSync(cp, css, 'utf8');
}
console.log('light theme added:', css.includes('[data-theme="light"]'));

// 4) theme logic in app.js
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let app = readFileSync(ap, 'utf8');
if (!app.includes('applyTheme')) {
  const themeCode = `
function applyTheme(mode) {
  const m = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', m);
  try { localStorage.setItem('swb-theme', m); } catch {}
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = m === 'light' ? '深色' : '浅色';
}

function initTheme() {
  let saved = 'dark';
  try { saved = localStorage.getItem('swb-theme') || 'dark'; } catch {}
  applyTheme(saved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(cur);
  };
}
`;
  app = app.replace("(async () => {\n  try { ST.platforms", themeCode + "\n(async () => {\n  initTheme();\n  try { ST.platforms");
  writeFileSync(ap, app, 'utf8');
}
console.log('theme logic added:', app.includes('applyTheme'));
