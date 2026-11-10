import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const old = `  let obj = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2000 });
    const o = extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }
  }
  if (!obj) throw new Error('模型两次都没给出可用正文，稍后重试');`;
const neu = `  let obj = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await chat({
      task: 'rewrite',
      messages: [{ role: 'user', content: prompt + '\\n只输出 JSON，不要任何解释。' + JSON_RULE }],
      temperature: attempt === 0 ? 0.7 : 0.5,
      maxTokens: 2600,
    });
    const o = extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }
    // 兜底：模型没给 JSON 就整段当正文，只要不像思考过程
    const raw = String(r.content || '').replace(/^\\s*\\{?[\\s\\S]*?"body"\\s*:\\s*"?/i, '').trim();
    if (attempt === 2 && raw.length > 40 && !looksLikeReasoning(raw)) {
      obj = { title: c.title, body: raw.replace(/[\\"}]\\s*$/,'').slice(0, 600), hashtags: c.hashtags };
      break;
    }
  }
  if (!obj) throw new Error('模型没给出可用正文（可能触发了质检），稍后重试');`;
if (!c.includes(old)) { console.log('anchor missing'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('rewrite fallback added');