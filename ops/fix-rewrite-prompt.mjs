import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');

/* 找到重写提示的构建段，整段替换为极简英文 prompt */
const startMark = '  const prompt = `重写这条 ${c.platform} 帖子';
const endMark = '  let obj = null;\n  for (let attempt = 0; attempt < 3; attempt++) {';
const i = c.indexOf(startMark);
const j = c.indexOf(endMark);
if (i < 0 || j < 0) { console.log('anchors missing', i, j); process.exit(1); }

const newPrompt = `  const shortIssues = issues.slice(0, 2).map((x) => String(x).slice(0, 90));
  const prompt = \`Rewrite this \${c.platform} post. Fix these problems:
\${shortIssues.map((x, k) => (k + 1) + '. ' + x).join('\\n') || '- tighten the opening'}

Original post:
\${String(c.body || '').slice(0, 500)}

Rules: keep the same facts; do not invent price, lead time, certificates or client cases; MOQ only as "500 pcs per design"; body <= 180 characters; no URL in the body; \${product ? 'product is ' + product.name + ' (SKU ' + product.sku + ');' : ''} brand is Packrivo, a Shenzhen-based packaging sourcing coordinator (not a factory).
Output the JSON object only, no reasoning, no explanation.
{"title":"one-line hook","body":"<=180 chars","hashtags":"3 tags"}\`;

`;

c = c.slice(0, i) + newPrompt + c.slice(j);

/* 收紧 token，避免模型把思考过程写进 content */
c = c.replace(
  "      maxTokens: 2600,\n    });",
  "      maxTokens: 700,\n    });"
);

/* 连续两次失败就换 analyze 任务的模型再试一次 */
c = c.replace(
  "  if (!obj) throw new Error('模型没给出可用正文（可能触发了质检），稍后重试');",
  `  if (!obj) {
    try {
      const r2 = await chat({ task: 'analyze', messages: [{ role: 'user', content: prompt }], temperature: 0.5, maxTokens: 900 });
      const o2 = extractJson(r2.content, ['body']);
      if (o2 && o2.body && !looksLikeReasoning(o2.body)) obj = o2;
    } catch {}
  }
  if (!obj) throw new Error('模型没给出可用正文（可能触发了质检），稍后重试');`
);

writeFileSync(p, c, 'utf8');
console.log('rewrite prompt tightened');
