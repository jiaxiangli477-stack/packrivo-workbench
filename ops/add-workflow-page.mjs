import { readFileSync, writeFileSync } from 'node:fs';

/* ---------------- server: /api/workflow ---------------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes("/api/workflow")) {
  s = s.replace(
    "/* ---------- 平台目录 ---------- */",
    `/* ---------- 固定工作流：每一步的实时状态 ---------- */
on('GET', /^\\/api\\/workflow$/, async () => {
  const snapRow = get('select payload, fetched_at from radar_snapshot where id = 1');
  let radar = null;
  try { radar = snapRow ? JSON.parse(snapRow.payload) : null; } catch {}
  const cnt = (sql, ...p) => { try { return get(sql, ...p).c || 0; } catch { return 0; } };
  return {
    radar_at: snapRow ? snapRow.fetched_at : null,
    counts: {
      videos: (radar?.videos || []).length,
      posts: (radar?.posts || []).length,
      articles: (radar?.articles || []).length,
      products_scraped: (radar?.products || []).length,
      competitors: (radar?.competitors || []).length,
      audit_items: (radar?.audit?.items || []).length,
      audit_kw: (radar?.audit?.keywords || []).length,
      products: cnt('select count(*) c from product'),
      kb: cnt('select count(*) c from kb_item where enabled = 1'),
      pending: cnt("select count(*) c from content where status = 'pending_review'"),
      approved: cnt("select count(*) c from content where status = 'approved'"),
      rejected: cnt("select count(*) c from content where status = 'rejected'"),
      scheduled: cnt("select count(*) c from schedule where state = 'pending'"),
      published: cnt("select count(*) c from publish_result where ok = 1 and channel <> 'mock'"),
      mock: cnt("select count(*) c from publish_result where ok = 1 and channel = 'mock'"),
      metrics: cnt('select count(*) c from metric'),
    },
  };
});

/* ---------- 平台目录 ---------- */`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: /api/workflow added');
}

/* ---------------- app.js: 工作流页面 ---------------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('async function viewWorkflow')) {
  const view = `
/* ================= 工作流 ================= */
const WF_STEPS = [
  ['1', '抓情报', 'radar', '视频 / 帖子 / 文章 / 商品 / 同行五路并行，全部过 kimi 质检'],
  ['2', '选品选题', 'products', '产品库 + 关键词库 + 知识库，决定这周写什么'],
  ['3', '二创', 'generate', '一稿多平台 or 博客转社媒，自动带产品级 UTM'],
  ['4', '审核', 'review', 'AI 预审 + 人工点通过；敏感闸门命中必须人工'],
  ['5', '排期', 'schedule', 'semi 模式：通过后才排，按平台配额错峰'],
  ['6', '发布', 'results', 'mock 只算测试发送，真实发布单独计'],
  ['7', '回填复盘', 'analytics', '曝光/互动/询盘按天回填，看板出结论'],
];

async function viewWorkflow() {
  const wf = await api('/api/workflow');
  const c = wf.counts;
  const stat = {
    radar: c.videos + c.posts + c.articles + c.products_scraped,
    products: c.products + c.kb,
    generate: c.pending + c.approved + c.rejected,
    review: c.pending,
    schedule: c.scheduled,
    results: c.published + c.mock,
    analytics: c.metrics,
  };
  $('#view').innerHTML = \`
    <div class="panel">
      <div class="panel-head"><h2>固定工作流 · 七步</h2><span class="hint">每天照着走；每步都有实时数字，卡在哪一步一眼看到</span></div>
      <div class="grid g4" style="margin-bottom:14px">
        <div class="panel kpi"><div class="k">情报池</div><div class="v">\${stat.radar}</div><div class="s">视频 \${c.videos} · 帖子 \${c.posts} · 文章 \${c.articles} · 商品 \${c.products_scraped}</div></div>
        <div class="panel kpi"><div class="k">待审稿</div><div class="v">\${c.pending}</div><div class="s">已通过 \${c.approved} · 已打回 \${c.rejected}</div></div>
        <div class="panel kpi"><div class="k">排期中</div><div class="v">\${c.scheduled}</div><div class="s">真实已发 \${c.published} · 测试 \${c.mock}</div></div>
        <div class="panel kpi"><div class="k">已回填</div><div class="v">\${c.metrics}</div><div class="s">按天记录，看板出结论</div></div>
      </div>
      <table>
        <thead><tr><th style="width:42px">#</th><th>这一步做什么</th><th style="width:120px">现在有多少</th><th style="width:110px"></th></tr></thead>
        <tbody>
          \${WF_STEPS.map(([n, name, go, desc]) => \`<tr>
            <td class="mono">\${n}</td>
            <td><b>\${esc(name)}</b><div class="muted" style="font-size:12px">\${esc(desc)}</div></td>
            <td class="num">\${stat[go] ?? 0}</td>
            <td><button class="btn ghost tiny" data-go="\${go}">去做</button></td>
          </tr>\`).join('')}
        </tbody>
      </table>
      <p class="muted" style="margin-top:12px;font-size:12px">情报快照：\${esc(wf.radar_at || '还没抓过')} · kimi 已审 \${c.audit_items + c.audit_kw} 条</p>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>每天/每周怎么跑</h2><span class="hint">照抄就行，不用想顺序</span></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div class="nav-label" style="padding-left:0">每天（2 分钟）</div>
          <ol class="muted" style="font-size:13px;line-height:1.9;padding-left:18px">
            <li>打开「审核队列」：AI 预审过的，扫一眼标题和 UTM，点通过或打回</li>
            <li>通过的进「发布 → 排期」，选平台和账号，定时间</li>
            <li>「发布结果」看有没有失败；mock 的不算真实发布</li>
          </ol>
        </div>
        <div>
          <div class="nav-label" style="padding-left:0">每周（30 分钟）</div>
          <ol class="muted" style="font-size:13px;line-height:1.9;padding-left:18px">
            <li>「情报雷达」点刷新，看新冒出来的视频/帖子/商品</li>
            <li>把想用的丢进「爆款库」，关键词丢进「知识库」</li>
            <li>「AI 二创」按产品生成 3–5 条，进审核</li>
            <li>「数据看板」回填上周曝光/询盘，看哪条带来询盘</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>发布通道</h2><span class="hint">现在只有 mock 可用；自建调度器接进来就能真发</span></div>
      <table>
        <thead><tr><th>通道</th><th>状态</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td>mock</td><td><span class="tag ok">可用</span></td><td>本地模拟，只记「测试发送」，不碰真实账号</td></tr>
          <tr><td>webhook</td><td><span class="tag info">可配</span></td><td>任意 HTTP 端点，适合接自建调度器或 n8n</td></tr>
          <tr><td>Postiz（自建）</td><td><span class="tag warn">待联调</span></td><td>AGPL，自建免费（只有云版收费）；填 Base URL + API Key 即可</td></tr>
          <tr><td>Mixpost（自建）</td><td><span class="tag warn">待联调</span></td><td>MIT，Lite 免费；API 需要 Pro 版</td></tr>
        </tbody>
      </table>
      <p class="muted" style="margin-top:10px;font-size:12px">换通道在「设置 → 默认通道」里选，接好后把 Base URL 和 Key 填进去即可。</p>
    </div>\`;
}

`;
  a = a.replace('/* ================= 账号 ================= */', view + '/* ================= 账号 ================= */');

  /* 路由表 */
  a = a.replace(
    "  products: [viewProducts, '产品与素材', '卖点写一次，反复用'],",
    "  workflow: [viewWorkflow, '工作流', '七步固定流程，卡在哪一步一眼看到'],\n  products: [viewProducts, '产品与素材', '卖点写一次，反复用'],"
  );
  writeFileSync(ap, a, 'utf8');
  console.log('app: workflow view added');
} else {
  console.log('workflow view exists');
}

/* ---------------- index.html: 导航入口 ---------------- */
const ip = 'E:/破甲工作区/social-workbench/web/index.html';
let h = readFileSync(ip, 'utf8');
if (!h.includes('data-nav="workflow"')) {
  h = h.replace(
    '<button data-nav="overview">总览</button>',
    '<button data-nav="workflow">工作流</button>\n        <button data-nav="overview">总览</button>'
  );
  writeFileSync(ip, h, 'utf8');
  console.log('nav: workflow added');
} else {
  console.log('nav exists');
}
