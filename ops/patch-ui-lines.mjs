import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const raw = readFileSync(p, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(eol);

// A) 工作台「保存并跑一轮」
const ai = lines.findIndex((l) => l.includes("$('#w-status').textContent = '抓取中：关键词联想"));
if (ai >= 0) {
  lines.splice(ai, 4, "      await runRadarRefresh(btn, $('#w-status'));");
  console.log('site A patched at line', ai + 1);
}

// B) 雷达页「刷新情报」按钮
const bi = lines.findIndex((l) => l.trim().startsWith("try { await api('/api/radar/refresh'"));
if (bi >= 0) {
  lines.splice(bi, 1, "    try { await runRadarRefresh(refresh, $('#w-status')); }");
  console.log('site B patched at line', bi + 1);
}

writeFileSync(p, lines.join(eol), 'utf8');
console.log('done');
