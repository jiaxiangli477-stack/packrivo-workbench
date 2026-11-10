import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); done.push(n); };

/* 标签挑选：2 垂类 + 1 大类 + 1 人群，按权重随机；与模型给的标签合并，最多 6 个 */
rep('tag-helper',
  '/* ---------- 固定工作流：每一步的实时状态 ---------- */',
  `/* ---------- 话题标签池 ---------- */
function pickTags(platform, extra = '', limit = 6) {
  const rows = all('select tag, tier, weight from hashtag where platform = ?', platform);
  const by = { broad: [], niche: [], audience: [] };
  for (const r of rows) (by[r.tier] || by.niche).push(r);
  const pick = (arr, n) => {
    const pool = [...arr];
    const out = [];
    while (pool.length && out.length < n) {
      const total = pool.reduce((a, x) => a + (x.weight || 50), 0);
      let t = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) { t -= pool[idx].weight || 50; if (t <= 0) break; }
      out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
    }
    return out;
  };
  const chosen = [...pick(by.niche, 2), ...pick(by.broad, 1), ...pick(by.audience, 1)].map((x) => x.tag);
  const existing = String(extra || '').split(/[\\s,]+/).map((t) => t.trim()).filter(Boolean);
  const merged = [];
  for (const t of [...existing, ...chosen]) {
    const k = t.toLowerCase();
    if (!merged.some((m) => m.toLowerCase() === k)) merged.push(t);
    if (merged.length >= limit) break;
  }
  return merged.join(' ');
}

on('GET', /^\\/api\\/hashtags$/, async (m, b) => {
  const platform = b.platform || '';
  return {
    hashtags: platform
      ? all('select * from hashtag where platform = ? order by tier, weight desc', platform)
      : all('select * from hashtag order by platform, tier, weight desc'),
  };
});

/* ---------- 固定工作流：每一步的实时状态 ---------- */`);

/* 生成内容后补标签 */
rep('generate-tags',
  `    run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + id, id);`,
  `    run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + id, id);
    run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), id);`);

/* 博客转社媒也补 */
rep('blog-tags',
  `      run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + newId, newId);`,
  `      run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + newId, newId);
      run('update content set hashtags = ? where id = ?', pickTags(platform, obj.hashtags || ''), newId);`);

writeFileSync(p, s, 'utf8');
console.log('done:', done.join(', '));
