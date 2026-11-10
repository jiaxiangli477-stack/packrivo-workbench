import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');
const old = "      const r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2400 });\n      const obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };\n      if (looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截');";
const neu = "      let r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2400 });\n      let obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };\n      if (looksLikeReasoning(obj.body)) {\n        r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + '\\n注意：只写可以直接发布的帖子正文，不要出现“我需要/让我想想/输出 JSON”这类思考过程。' + JSON_RULE }], temperature: 0.5, maxTokens: 2400 });\n        obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };\n      }\n      if (looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截');";
if (s.includes(old)) {
  s = s.replace(old, neu);
  writeFileSync(p, s, 'utf8');
  console.log('blog retry added');
} else {
  console.log('anchor missing');
}
