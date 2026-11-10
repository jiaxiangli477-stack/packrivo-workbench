import { readFileSync, writeFileSync } from 'node:fs';

/* ---- radar: 文章每词 8 条 ---- */
const rp = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let r = readFileSync(rp, 'utf8');
r = r.replace('const res = await searchGoogleNews(`${seed} packaging`, 4);', 'const res = await searchGoogleNews(`${seed} packaging`, 8);');
writeFileSync(rp, r, 'utf8');
console.log('radar article per-seed:', r.includes('searchGoogleNews(`${seed} packaging`, 8)'));

/* ---- server: 思考过程泄漏拦截 + UTM 清洗 ---- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!s.includes(a)) { miss.push(n); return; } s = s.replace(a, b); done.push(n); };

rep('leak-helper',
  '/* ---------- 品牌知识库 ---------- */',
  `/* 模型思考过程泄漏识别：这类文本绝不能进内容库 */
const LEAK_PATTERNS = [
  /we need (answer|output|craft|respond)/i,
  /i need (to )?(respond|answer|craft|produce)/i,
  /let me (think|craft|write|analyze)/i,
  /(^|\\n)\\s*Here('| i)s (the|my) (plan|thinking)/i,
  /只输出\\s*JSON/i,
  /需要(输出|返回)\\s*JSON/i,
  /^(\\s*)\\x60\\x60\\x60/,
  /json object\\.?\\s*(need|we|i)\\b/i,
];
function looksLikeReasoning(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return LEAK_PATTERNS.some((re) => re.test(t));
}

/* ---------- 品牌知识库 ---------- */`);

/* 生成：泄漏就重试一次，仍泄漏则拒绝入库 */
rep('generate-leak',
  `    let r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.8, maxTokens: 2600 });
    let obj = extractJson(r.content, ['body']);`,
  `    let r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.8, maxTokens: 2600 });
    let obj = extractJson(r.content, ['body']);
    if (obj && looksLikeReasoning(obj.body)) {
      // 模型把思考过程当正文了，重试一次
      r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + '\\n注意：正文必须是可直接发布的帖子，不要写任何"我需要/让我想想/输出 JSON"之类的话。' + JSON_RULE }], temperature: 0.6, maxTokens: 2600 });
      obj = extractJson(r.content, ['body']);
    }
    if (obj && looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截，请重试（这条不会入审核队列）');`);

/* 博客转社媒：同样拦截 */
rep('blog-leak',
  `      const obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };`,
  `      const obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };
      if (looksLikeReasoning(obj.body)) throw new Error('模型输出的是思考过程，已拦截');`);

/* AI 预审：正文是思考过程直接判拒 */
rep('review-leak',
  `  const hits = sensitiveHits(\`\${c.title || ''}\\n\${c.body}\\n\${c.hashtags || ''}\`);`,
  `  if (looksLikeReasoning(c.body)) {
    const objLeak = { score: 0, decision: 'reject', issues: ['正文是模型思考过程，不是可发布的帖子'], reason: '自动拦截：检测到 reasoning 泄漏' };
    run('insert into review(content_id, reviewer_kind, decision, score, notes) values (?,?,?,?,?)', id, 'ai', 'reject', 0, JSON.stringify(objLeak));
    run("update content set status = 'rejected' where id = ?", id);
    return { ok: true, ai: objLeak, via: 'leak-guard', applied: false, forced_manual: false, sensitive_hits: [] };
  }
  const hits = sensitiveHits(\`\${c.title || ''}\\n\${c.body}\\n\${c.hashtags || ''}\`);`);

/* UTM slug 清洗：去掉 amp / 连续横线 */
rep('utm-sanitize',
  `    const slug = String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || product.sku.toLowerCase();`,
  `    const slug = String(product.name).toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || product.sku.toLowerCase();`);

writeFileSync(sp, s, 'utf8');
console.log('server done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
