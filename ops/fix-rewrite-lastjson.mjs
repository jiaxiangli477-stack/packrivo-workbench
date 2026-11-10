import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');

/* 在重写路由里：从整段输出里找「最后一个带 body 的 JSON 对象」，
   因为模型常把思考过程写进 content，真正的答案在末尾 */
if (!c.includes('function jsonObjectsIn')) {
  c = c.replace(
    'function extractJson(text, required = []) {',
    `function jsonObjectsIn(text) {
  const s = String(text || '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') {
        depth--;
        if (depth === 0) {
          try {
            const o = JSON.parse(s.slice(i, j + 1));
            if (o && typeof o === 'object') out.push(o);
          } catch {}
          break;
        }
      }
    }
  }
  return out;
}

function extractJson(text, required = []) {`
  );
}

/* 重写解析：优先最后一个合法对象 */
c = c.replace(
  `    const o = extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }`,
  `    const candidates = [...jsonObjectsIn(r.content)].reverse();
    const o = candidates.find((x) => x && x.body && String(x.body).trim() && !looksLikeReasoning(x.body))
      || extractJson(r.content, ['body']);
    if (o && o.body && !looksLikeReasoning(o.body)) { obj = o; break; }`
);

writeFileSync(p, c, 'utf8');
console.log('rewrite: last-json extraction added');
