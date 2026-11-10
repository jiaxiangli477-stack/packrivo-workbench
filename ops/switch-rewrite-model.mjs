import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
// 重写优先用 analyze(space-bunny) 这类非强推理模型
const old = "    const r = await chat({\n      task: 'rewrite',";
const neu = "    const r = await chat({\n      task: 'analyze',";
if (!c.includes(old)) { console.log('MISS chat task'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('rewrite now uses analyze task (space-bunny)');