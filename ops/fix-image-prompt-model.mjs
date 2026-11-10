import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
// 出图提示词用快模型，别占 kimi
const before = c.split("const r = await chat({ task: 'analyze', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });").length - 1;
c = c.split("const r = await chat({ task: 'analyze', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });")
     .join("const r = await chat({ task: 'analyze', model: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: ask }], temperature: 0.6, maxTokens: 700 });");
writeFileSync(p, c, 'utf8');
console.log('patched image-prompt calls:', before);