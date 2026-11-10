import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

/* 标签归一：社媒加 #，Pinterest 用纯关键词 */
rep('tag-normalize',
  `  const merged = [];
  for (const t of [...existing, ...chosen]) {
    const k = t.toLowerCase();
    if (!merged.some((m) => m.toLowerCase() === k)) merged.push(t);
    if (merged.length >= limit) break;
  }
  return merged.join(' ');`,
  `  const hashed = ['bluesky', 'instagram', 'tiktok', 'mastodon', 'threads', 'x', 'threads', 'youtube'].includes(platform);
  const norm = (t) => {
    const raw = String(t).trim().replace(/^#+/, '');
    if (!raw) return '';
    return hashed ? '#' + raw.replace(/\\s+/g, '') : raw;
  };
  const merged = [];
  for (const t of [...existing, ...chosen]) {
    const v = norm(t);
    if (!v) continue;
    const k = v.toLowerCase();
    if (!merged.some((m) => m.toLowerCase() === k)) merged.push(v);
    if (merged.length >= limit) break;
  }
  return merged.join(' ');`);

/* 生成提示里加平台字数上限 */
rep('platform-limit',
  `    const prompt = \`你是外贸 B2B 社媒文案。产品：\${product.name}（\${product.sku}）
卖点：\${product.selling_points}`,
  `    const LIMIT = platform === 'bluesky' ? '正文≤250字符（含链接和标签总计≤300）' : platform === 'x' ? '正文≤240字符' : platform === 'instagram' ? '正文≤1800字符，前125字符要能独立成句' : '正文≤600字符';
    const prompt = \`你是外贸 B2B 社媒文案。产品：\${product.name}（\${product.sku}）
字数要求：\${LIMIT}
卖点：\${product.selling_points}`);

writeFileSync(p, s, 'utf8');
console.log('done:', done.join(', '));
