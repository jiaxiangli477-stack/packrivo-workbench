import { readFileSync, writeFileSync } from 'node:fs';
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!s.includes(a)) { miss.push(n); return; } s = s.replace(a, b); done.push(n); };

/* 账号：没有凭据就是未授权 */
rep('account-status',
  `on('GET', /^\\/api\\/accounts$/, async () => ({
  accounts: all(\`select a.*, (select count(*) from credential c where c.owner_kind='account' and c.owner_id=a.id) as cred_count
                 from account a order by a.id desc\`),
}));`,
  `on('GET', /^\\/api\\/accounts$/, async () => ({
  accounts: all(\`select a.*, (select count(*) from credential c where c.owner_kind='account' and c.owner_id=a.id) as cred_count
                 from account a order by a.id desc\`).map((a) => ({
    ...a,
    status_view: a.cred_count > 0 && a.session_state === 'ok' ? '已授权' : '未授权',
  })),
}));`);

/* 博客转社媒 */
rep('blog-import',
  `/* ---------- 平台目录 ---------- */`,
  `/* ---------- 博客转社媒 ---------- */
on('POST', /^\\/api\\/blog\\/import$/, async (m, b) => {
  const url = String(b.url || '').trim();
  if (!/^https?:\\/\\//i.test(url)) throw new Error('请填写完整博客链接（含 https://）');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: ac.signal, redirect: 'follow' });
    if (!r.ok) throw new Error('博客打不开：HTTP ' + r.status);
    html = await r.text();
  } catch (e) {
    throw new Error('读取博客失败：' + e.message);
  } finally { clearTimeout(timer); }

  const strip = (x) => String(x || '').replace(/<script[\\s\\S]*?<\\/script>/gi, '').replace(/<style[\\s\\S]*?<\\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
  const title = strip((html.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i) || [])[1] || (html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i) || [])[1] || '') || 'Blog post';
  const h2s = [...html.matchAll(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/gi)].map((x) => strip(x[1])).filter(Boolean).slice(0, 8);
  const paras = [...html.matchAll(/<p[^>]*>([\\s\\S]*?)<\\/p>/gi)].map((x) => strip(x[1])).filter((x) => x.length > 60).slice(0, 6);

  const platforms = (Array.isArray(b.platforms) && b.platforms.length ? b.platforms : ['facebook_page', 'instagram', 'linkedin']).slice(0, 5);
  const product = b.product_id ? get('select * from product where id = ?', Number(b.product_id)) : get('select * from product order by id desc limit 1');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'blog';
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');

  const made = [];
  const errors = [];
  for (const platform of platforms) {
    try {
      const prompt = \`把下面这篇博客改写成一条 \${platform} 帖子。语言=英文，语气=专业。
要求：借用文章的要点与顺序，不要整段照抄；不得编造价格、折扣、交期、认证、客户案例或电话；MOQ 只能写 "500 pcs per design"。
\${kbContext(2500)}
博客标题：\${title}
小标题：\${h2s.join(' | ')}
要点：\${paras.join(' ')}
关联产品：\${product ? product.name + '（' + (product.selling_points || '') + '）' : '(无)'}
平台文体：\${PLATFORM_STYLE[platform] || '通用社媒'}
输出 JSON：{"title":"...","body":"...","hashtags":"..."}\`;
      const r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.7, maxTokens: 2400 });
      const obj = extractJson(r.content, ['body']) || { title: title, body: String(r.content).slice(0, 1200), hashtags: '' };
      const utm = \`\${url}\${url.includes('?') ? '&' : '?'}utm_source=\${platform}&utm_medium=social&utm_campaign=\${slug}-\${yymm}\`;
      const ins = run(
        'insert into content(product_id, platform, lang, title, body, hashtags, utm_url, status, model) values (?,?,?,?,?,?,?,?,?)',
        product ? product.id : null, platform, 'en', obj.title || title, obj.body || '', obj.hashtags || '', utm, 'pending_review', r.model || ''
      );
      made.push({ id: Number(ins.lastInsertRowid), platform });
    } catch (e) {
      errors.push({ platform, error: e.message });
    }
  }
  audit('blog.import', url, { created: made.length });
  return { ok: made.length > 0, source: { url, title, headings: h2s, paragraphs: paras.length }, created: made, errors };
});

/* ---------- 平台目录 ---------- */`);

writeFileSync(sp, s, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
