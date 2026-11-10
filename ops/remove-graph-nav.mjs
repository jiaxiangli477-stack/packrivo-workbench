import { readFileSync, writeFileSync } from 'node:fs';
// 1) 撤掉 nav 入口
const ip = 'E:/破甲工作区/social-workbench/web/index.html';
let h = readFileSync(ip, 'utf8');
h = h.replace('        <button data-view="graph">链路图</button>\n', '');
h = h.replace('<button data-view="graph">链路图</button>\n        ', '');
writeFileSync(ip, h, 'utf8');
console.log('nav removed:', !h.includes('data-view="graph"'));

// 2) 撤掉路由（保留函数但不可达；更稳妥是删掉路由行）
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
a = a.replace("  graph: [viewGraph, '链路图', '节点图看链路进度'],\n", '');
writeFileSync(ap, a, 'utf8');
console.log('route removed:', !a.includes("graph: [viewGraph"));