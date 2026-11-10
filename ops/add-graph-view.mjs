import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- 1) server: /api/graph ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
if (!s.includes('/api/graph')) {
  s = s.replace(
    '/* ---------- 本地素材 ---------- */',
    `/* ---------- 链路图数据 ---------- */
on('GET', /^\\/api\\/graph$/, async () => {
  const snapRow = get('select payload, fetched_at from radar_snapshot where id = 1');
  let radar = null;
  try { radar = snapRow ? JSON.parse(snapRow.payload) : null; } catch {}
  const cnt = (sql, ...p) => { try { return get(sql, ...p).c || 0; } catch { return 0; } };

  const nodes = [
    { key: 'radar', label: '情报采集', count: (radar?.videos?.length || 0) + (radar?.posts?.length || 0) + (radar?.articles?.length || 0) + (radar?.products?.length || 0), hint: '视频/帖子/文章/商品', go: 'radar' },
    { key: 'audit', label: 'kimi 质检', count: (radar?.audit?.items?.length || 0) + (radar?.audit?.keywords?.length || 0), hint: '雷达条目+关键词', go: 'radar' },
    { key: 'brief', label: 'kimi 简报', count: cnt("select count(*) c from content where model = 'rewrite-by-analysis'") , hint: '定角度/钩子/结构', go: 'generate' },
    { key: 'write', label: 'flash 写稿', count: cnt('select count(*) c from content'), hint: '一稿多平台', go: 'generate' },
    { key: 'image', label: '配图', count: cnt('select count(*) c from content where image_path is not null'), hint: '本地 SD / 或外部 API', go: 'review' },
    { key: 'review', label: '人工审核', count: cnt("select count(*) c from content where status = 'pending_review'"), hint: '待审', go: 'review' },
    { key: 'approve', label: '已通过', count: cnt("select count(*) c from content where status in ('approved','scheduled','published')"), hint: '', go: 'review' },
    { key: 'schedule', label: '排期', count: cnt("select count(*) c from schedule where state in ('pending','queued')"), hint: '', go: 'schedule' },
    { key: 'publish', label: '发布', count: cnt("select count(*) c from publish_result where ok = 1"), hint: '真实+测试', go: 'results' },
    { key: 'metrics', label: '数据回填', count: cnt('select count(*) c from metric'), hint: '曝光/互动/询盘', go: 'analytics' },
  ];

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push({ from: nodes[i].key, to: nodes[i + 1].key, kind: 'flow' });
  edges.push({ from: 'review', to: 'write', kind: 'reject', label: '打回重写' });
  edges.push({ from: 'metrics', to: 'radar', kind: 'loop', label: '复盘选题' });

  return { nodes, edges, at: snapRow ? snapRow.fetched_at : null };
});

/* ---------- 本地素材 ---------- */`
  );
  writeFileSync(sp, s, 'utf8');
  console.log('server: /api/graph added');
}

/* ---------- 2) UI：链路图 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let a = readFileSync(ap, 'utf8');
if (!a.includes('async function viewGraph')) {
  const view = `
/* ================= 链路图 ================= */
async function viewGraph() {
  const g = await api('/api/graph');
  const cols = 5;
  const W = 210, H = 96, GX = 60, GY = 70, PAD = 24;
  const rows = Math.ceil(g.nodes.length / cols);
  const width = PAD * 2 + cols * W + (cols - 1) * GX;
  const height = PAD * 2 + rows * H + (rows - 1) * GY + 40;

  const pos = {};
  g.nodes.forEach((n, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    pos[n.key] = { x: PAD + c * (W + GX), y: PAD + r * (H + GY) };
  });

  const stateOf = (n) => (n.count > 0 ? 'has' : 'empty');
  const color = { has: '#2b7a4b', empty: '#3a4658', hot: '#8a6d1f' };

  const svgNodes = g.nodes.map((n) => {
    const p = pos[n.key];
    const st = stateOf(n);
    const stroke = n.key === 'review' && n.count > 0 ? '#c08a2e' : color[st];
    return \`<g class="gnode" data-go="\${n.go}" style="cursor:pointer">
      <rect x="\${p.x}" y="\${p.y}" width="\${W}" height="\${H}" rx="12" fill="var(--surface-2)" stroke="\${stroke}" stroke-width="1.5" />
      <text x="\${p.x + 14}" y="\${p.y + 30}" fill="var(--text)" font-size="15" font-weight="600">\${esc(n.label)}</text>
      <text x="\${p.x + 14}" y="\${p.y + 56}" fill="var(--muted)" font-size="12">\${esc(n.hint || '')}</text>
      <text x="\${p.x + W - 14}" y="\${p.y + 30}" text-anchor="end" fill="\${stroke}" font-size="20" font-weight="700">\${n.count}</text>
    </g>\`;
  }).join('');

  const svgEdges = g.edges.map((e) => {
    const a1 = pos[e.from], b1 = pos[e.to];
    if (!a1 || !b1) return '';
    if (e.kind === 'flow') {
      const x1 = a1.x + W, y1 = a1.y + H / 2;
      const x2 = b1.x, y2 = b1.y + H / 2;
      const mx = (x1 + x2) / 2;
      const sameRow = Math.abs(a1.y - b1.y) < 5;
      const d = sameRow ? \`M\${x1},\${y1} C\${mx},\${y1} \${mx},\${y2} \${x2},\${y2}\` : \`M\${a1.x + W / 2},\${a1.y + H} C\${a1.x + W / 2},\${a1.y + H + GY / 2} \${b1.x + W / 2},\${b1.y - GY / 2} \${b1.x + W / 2},\${b1.y}\`;
      return \`<path d="\${d}" fill="none" stroke="var(--line)" stroke-width="1.6" marker-end="url(#arrow)" />\`;
    }
    if (e.kind === 'reject') {
      const x1 = a1.x + W / 2, y1 = a1.y;
      const x2 = b1.x + W / 2, y2 = b1.y + H;
      return \`<path d="M\${x1},\${y1} C\${x1},\${y1 - 60} \${x2},\${y2 + 60} \${x2},\${y2}" fill="none" stroke="#c08a2e" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#arrow2)" />
        <text x="\${(x1 + x2) / 2}" y="\${Math.min(y1, y2) - 8}" fill="#c08a2e" font-size="11" text-anchor="middle">\${esc(e.label)}</text>\`;
    }
    const x1 = a1.x + W / 2, y1 = a1.y + H;
    const x2 = b1.x + W / 2, y2 = b1.y + H;
    return \`<path d="M\${x1},\${y1} C\${x1},\${y1 + 40} \${x2},\${y2 + 40} \${x2},\${y2}" fill="none" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="4 4" marker-end="url(#arrow2)" opacity="0.7" />\`;
  }).join('');

  $('#view').innerHTML = \`
    <div class="panel">
      <div class="panel-head"><h2>链路图</h2><span class="hint">每个方块是链路的一环，数字是当前数量；点方块跳到对应页面 · 情报快照 \${esc(g.at || '还没抓过')}</span></div>
      <div style="overflow:auto">
        <svg viewBox="0 0 \${width} \${height}" width="\${width}" height="\${height}" style="max-width:100%">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--line)" />
            </marker>
            <marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#c08a2e" />
            </marker>
          </defs>
          \${svgEdges}
          \${svgNodes}
        </svg>
      </div>
      <div class="row" style="gap:18px;margin-top:10px">
        <span class="muted" style="font-size:12px"><span style="display:inline-block;width:10px;height:10px;background:#2b7a4b;border-radius:3px;margin-right:6px"></span>有产出</span>
        <span class="muted" style="font-size:12px"><span style="display:inline-block;width:10px;height:10px;background:#c08a2e;border-radius:3px;margin-right:6px"></span>待人工</span>
        <span class="muted" style="font-size:12px"><span style="display:inline-block;width:10px;height:10px;background:#3a4658;border-radius:3px;margin-right:6px"></span>空/未开始</span>
        <span class="muted" style="font-size:12px">虚线：打回重写 / 复盘回流</span>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>当前卡点</h2><span class="hint">按链路顺序列出数量与下一步动作</span></div>
      <table>
        <thead><tr><th>环节</th><th>数量</th><th>说明</th><th></th></tr></thead>
        <tbody>
          \${g.nodes.map((n) => \`<tr>
            <td>\${esc(n.label)}</td>
            <td class="num">\${n.count}</td>
            <td class="muted">\${esc(n.hint || '')}</td>
            <td><button class="btn ghost tiny" data-go="\${n.go}">去做</button></td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>\`;
}

`;
  a = a.replace('/* ================= 工作流 ================= */', view + '/* ================= 工作流 ================= */');
  a = a.replace(
    "  workflow: [viewWorkflow, '工作流', '七步固定流程，卡在哪一步一眼看到'],",
    "  graph: [viewGraph, '链路图', '节点图看链路进度'],\n  workflow: [viewWorkflow, '工作流', '七步固定流程，卡在哪一步一眼看到'],"
  );
  writeFileSync(ap, a, 'utf8');
  console.log('ui: graph view added');
}

/* ---------- 3) 导航 ---------- */
const ip = 'E:/破甲工作区/social-workbench/web/index.html';
let h = readFileSync(ip, 'utf8');
if (!h.includes('data-view="graph"')) {
  h = h.replace('<button data-view="workflow">工作流</button>', '<button data-view="graph">链路图</button>\n        <button data-view="workflow">工作流</button>');
  writeFileSync(ip, h, 'utf8');
  console.log('nav: graph added');
}
