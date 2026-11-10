import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- server: 生成前先让 kimi 出简报 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

rep('brief-step',
  "  const LIMIT = platform === 'bluesky' ? '正文≤250 字符；加上链接和标签后必须 ≤300 字符（Bluesky 硬限制）'",
  `  /* 先由 kimi（监工）出内容简报：决定角度、钩子、结构与证据点，再交给执行模型写 */
  let brief = null;
  try {
    const briefPrompt = \`你是外贸包装 B2B 内容总监。为下面这条 \${platform} 帖子定调，只输出 JSON。
产品：\${product.name}（\${product.sku}）
卖点：\${product.selling_points || ''}
目标读者：欧美做首饰/蜡烛/礼品的小品牌创始人
\${kbContext(1200)}
要求：给一个具体角度（不要泛泛而谈）、一句钩子、3-4 段结构、1-2 个可验证的证据点（只能来自卖点/知识库）、一句 CTA。
输出：{"angle":"...","hook":"...","structure":["..."],"proof":["..."],"cta":"..."}\`;
    const br = await chat({ task: 'brief', messages: [{ role: 'user', content: briefPrompt }], temperature: 0.6, maxTokens: 800 });
    const objs = jsonObjectsIn(br.content).reverse();
    brief = objs.find((x) => x && (x.hook || x.angle)) || null;
    if (brief) audit('content.brief', String(product.id), { angle: brief.angle || '', via: br.via });
  } catch {}

  const LIMIT = platform === 'bluesky' ? '正文≤250 字符；加上链接和标签后必须 ≤300 字符（Bluesky 硬限制）'`);

rep('brief-in-prompt',
  "   \${style}。",
  `   \${style}。
   \${brief ? '内容简报（必须照这个角度写）：角度=' + brief.angle + '；钩子=' + brief.hook + '；结构=' + (brief.structure || []).join(' / ') + '；证据点=' + (brief.proof || []).join(' / ') + '；CTA=' + brief.cta : ''}`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));

/* ---------- 设置页：任务下拉加「内容简报」 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
const oldList = "[['deconstruct', '爆款拆解'], ['rewrite', '文案改写'], ['review', '审核预审'], ['analyze', 'SEO/GEO 分析'], ['audit', 'kimi 质检'], ['report', '报告撰写']]";
const newList = "[['brief', '内容简报(监工)'], ['deconstruct', '爆款拆解'], ['rewrite', '文案改写'], ['review', '审核预审'], ['analyze', 'SEO/GEO 分析'], ['audit', 'kimi 质检'], ['report', '报告撰写']]";
if (a.includes(oldList)) { a = a.replace(oldList, () => newList); writeFileSync(ap, a, 'utf8'); console.log('ui: brief task added'); }
else console.log('ui MISS task list');
