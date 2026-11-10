import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- 1) db: platform_tag_policy ---------- */
const dp = 'E:/破甲工作区/social-workbench/app/db.mjs';
let d = readFileSync(dp, 'utf8');
if (!d.includes('platform_tag_policy')) {
  d = d.replace(
    '/* 老库补列：content.image_path / image_alt */',
    `/* 平台标签策略（ARTEX 任务 #10 交付） */
db.exec(\`create table if not exists platform_tag_policy (
  platform text primary key,
  min_tags integer not null default 2,
  max_tags integer not null default 5,
  layer_quota text not null default '{"broad":1,"niche":2,"audience":1}',
  tag_style text not null default 'hashtag',
  link_mode text not null default 'text',
  text_limit integer not null default 600,
  note text default ''
)\`);
{
  const seed = [
    ['bluesky', 2, 3, '{"broad":1,"niche":2,"audience":1}', 'hashtag', 'embed', 300, '链接走 link card，不占正文'],
    ['instagram', 6, 12, '{"broad":2,"niche":4,"audience":3}', 'hashtag', 'profile', 2200, '链接放 bio，正文不堆链接'],
    ['pinterest', 5, 8, '{"broad":2,"niche":3,"audience":2}', 'keyword', 'text', 500, '关键词式，不用 #'],
    ['tiktok', 2, 4, '{"broad":1,"niche":2,"audience":1}', 'hashtag', 'profile', 2200, ''],
    ['facebook_page', 2, 3, '{"broad":1,"niche":1,"audience":1}', 'hashtag', 'text', 600, ''],
  ];
  const ins = db.prepare('insert or ignore into platform_tag_policy(platform,min_tags,max_tags,layer_quota,tag_style,link_mode,text_limit,note) values (?,?,?,?,?,?,?,?)');
  for (const r of seed) ins.run(...r);
}

/* 老库补列：content.image_path / image_alt */`
  );
  writeFileSync(dp, d, 'utf8');
  console.log('db: platform_tag_policy added');
}

/* ---------- 2) server: pickTags 按策略配额 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const oldPick = s.indexOf('function pickTags(platform, extra = \'\', limit = 6) {');
const endMark = '  return merged.join(\' \');\n}';
const endIdx = s.indexOf(endMark, oldPick);
if (oldPick < 0 || endIdx < 0) { console.log('pickTags anchors missing'); process.exit(1); }

const newPick = `function pickTags(platform, extra = '') {
  const policy = get('select * from platform_tag_policy where platform = ?', platform)
    || { min_tags: 2, max_tags: 5, layer_quota: '{"broad":1,"niche":2,"audience":1}', tag_style: 'hashtag' };
  let quota = { broad: 1, niche: 2, audience: 1 };
  try { quota = JSON.parse(policy.layer_quota); } catch {}

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

  const chosen = [
    ...pick(by.broad, quota.broad || 0),
    ...pick(by.niche, quota.niche || 0),
    ...pick(by.audience, quota.audience || 0),
  ].map((x) => x.tag);

  const hashed = policy.tag_style === 'hashtag';
  const norm = (t) => {
    const raw = String(t).trim().replace(/^#+/, '');
    if (!raw) return '';
    return hashed ? '#' + raw.replace(/\\s+/g, '') : raw;
  };

  const merged = [];
  for (const t of [...String(extra || '').split(/[\\s,]+/).filter(Boolean), ...chosen]) {
    const v = norm(t);
    if (!v) continue;
    const k = v.toLowerCase();
    if (merged.some((m) => m.toLowerCase() === k)) continue;
    merged.push(v);
  }
  return merged.slice(0, policy.max_tags || 5).join(' ');
}`;

s = s.slice(0, oldPick) + newPick + s.slice(endIdx + endMark.length);

/* MOQ 写法归一 */
s = s.replace(
  "    const id = Number(ins.lastInsertRowid);\n    run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + id, id);",
  `    const id = Number(ins.lastInsertRowid);
    run('update content set utm_url = ? where id = ?', utm + '&utm_content=c' + id, id);
    run("update content set body = replace(replace(replace(body,'500 pcs/design','500 pcs per design'),'500pcs/design','500 pcs per design'),'MOQ 500 pcs per design per design','MOQ 500 pcs per design') where id = ?", id);`
);

writeFileSync(sp, s, 'utf8');
console.log('server: pickTags rewritten with policy + MOQ normalize');
