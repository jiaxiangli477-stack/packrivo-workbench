/* Packrivo 外贸社媒工作台 · 前端（无构建，原生 JS） */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'k';
  return String(Math.round(v * 10) / 10);
};
const pct = (n) => (Number(n) || 0).toFixed(1) + '%';
const pname = (code) => { const p = (ST.platforms || []).find((x) => x.code === code); return p ? p.label : String(code || ''); };

/* SEC-02：本机服务开了令牌校验后，页面必须带 x-swb-token。
   令牌由同源的 /swb-env.js 下发（无 CORS 头，别的站点读不到内容）。 */
let SWB_TOKEN = '';
async function tokenOnce() {
  if (SWB_TOKEN) return SWB_TOKEN;
  try {
    const r = await fetch('/swb-env.js', { cache: 'no-store' });
    const t = await r.text();
    const m = t.match(/"token"\s*:\s*"([0-9a-f]+)"/i);
    SWB_TOKEN = m ? m[1] : '';
  } catch { SWB_TOKEN = ''; }
  return SWB_TOKEN;
}

async function api(path, method = 'GET', body) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  const tk = await tokenOnce();
  if (tk) headers['x-swb-token'] = tk;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error || 'HTTP ' + res.status);
    err.code = data.code || '';
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), bad ? 6500 : 3200);
}

const ST = { view: 'overview', days: 30, platforms: [], contents: [] };

const CH_STATE = {
  ready: { text: '已跑通', cls: 'ok' },
  local_sim: { text: '本地模拟', cls: 'mute' },
  pending_config: { text: '填配置即通', cls: 'warn' },
  pending_postiz: { text: '待 Postiz 联调', cls: 'warn' },
  pending_api: { text: '待平台资质', cls: 'mute' },
  pending_connect: { text: '服务没连上', cls: 'warn' },
  pending_credential: { text: '待填 Key', cls: 'warn' },
  pending_media: { text: '缺素材', cls: 'warn' },
  pending_session: { text: '需浏览器会话', cls: 'info' },
  manual_only: { text: '只能人工', cls: 'mute' },
};
const KIND = { social: '社媒', forum: '论坛', b2b: 'B2B 平台', im: '私信/EDM', local: '本地' };
const chTag = (s) => {
  const m = CH_STATE[s] || { text: s, cls: 'mute' };
  return `<span class="tag ${m.cls}"><span class="dot-s"></span>${esc(m.text)}</span>`;
};

/* ================= 图表 ================= */
function prepCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 600;
  const h = cv.clientHeight || 220;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawLine(cv, series, defs) {
  const { ctx, w, h } = prepCanvas(cv);
  const pad = { l: 42, r: 12, t: 14, b: 24 };
  const max = Math.max(1, ...series.map((p) => Math.max(...defs.map((d) => p[d.key] || 0))));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i) => pad.l + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v) => pad.t + innerH - (v / max) * innerH;

  ctx.strokeStyle = 'rgba(255,255,255,.055)';
  ctx.fillStyle = '#6f7f97';
  ctx.font = '10.5px Segoe UI, sans-serif';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const gy = pad.t + (innerH / 3) * g;
    ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
    const val = max - (max / 3) * g;
    ctx.fillText(fmt(val), 4, gy + 3);
  }
  const step = Math.max(1, Math.ceil(series.length / 8));
  let lastLabelX = -999;
  series.forEach((p, i) => {
    const isLast = i === series.length - 1;
    if (i % step !== 0 && !isLast) return;
    const label = String(p.day).slice(5);
    const tw = ctx.measureText(label).width;
    let lx = Math.min(w - pad.r - tw, Math.max(pad.l, x(i) - tw / 2));
    if (lx - lastLabelX < tw + 14) return;
    lastLabelX = lx;
    ctx.fillStyle = '#55637a';
    ctx.fillText(label, lx, h - 6);
  });

  defs.forEach((d, di) => {
    const pts = series.map((p, i) => [x(i), y(p[d.key] || 0)]);
    if (d.area) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + innerH);
      grad.addColorStop(0, d.areaFrom || 'rgba(79,140,255,.30)');
      grad.addColorStop(1, 'rgba(79,140,255,0)');
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pad.t + innerH);
      pts.forEach(([px, py]) => ctx.lineTo(px, py));
      ctx.lineTo(pts[pts.length - 1][0], pad.t + innerH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (series.length <= 40) {
      pts.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      });
    }
  });
}

function drawBars(cv, rows, labelKey, valueKey, color) {
  const { ctx, w, h } = prepCanvas(cv);
  if (!rows.length) {
    ctx.fillStyle = '#55637a'; ctx.font = '12px Segoe UI'; ctx.fillText('还没有数据', 12, h / 2);
    return;
  }
  const padL = 104, padR = 46, rowH = Math.min(26, (h - 8) / rows.length);
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  rows.slice(0, 9).forEach((r, i) => {
    const yy = 6 + i * rowH;
    const bw = ((Number(r[valueKey]) || 0) / max) * (w - padL - padR);
    ctx.fillStyle = '#8ea3c0'; ctx.font = '11.5px Segoe UI';
    ctx.fillText(String(r[labelKey]).slice(0, 14), 2, yy + rowH * 0.62);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(padL, yy + rowH * 0.24, w - padL - padR, Math.max(6, rowH * 0.5));
    const grad = ctx.createLinearGradient(padL, 0, padL + bw, 0);
    grad.addColorStop(0, color || '#4f8cff');
    grad.addColorStop(1, 'rgba(124,92,255,.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(padL, yy + rowH * 0.24, Math.max(2, bw), Math.max(6, rowH * 0.5));
    ctx.fillStyle = '#c3d2e8';
    ctx.fillText(fmt(r[valueKey]), padL + bw + 6, yy + rowH * 0.62);
  });
}

/* ================= 总览 ================= */
async function viewOverview() {
  const [ov, plat, led, met, contents] = await Promise.all([
    api('/api/overview'),
    api('/api/platforms'),
    api('/api/ledger'),
    api('/api/metrics/overview?days=30'),
    api('/api/contents'),
  ]);
  let pz = { configured: false };
  try { pz = await api('/api/channels/postiz'); } catch {}
  const pending = contents.contents.filter((c) => c.status === 'pending_review');
  const readyCount = plat.platforms.filter((p) => p.channel_state === 'ready' || p.channel_state === 'pending_config' || p.accounts > 0).length;
  const groups = ['social', 'forum', 'b2b', 'im'];

  $('#view').innerHTML = `
    <div class="grid g4">
      <div class="panel kpi warn">
        <div class="k">待审内容</div>
        <div class="v">${pending.length}</div>
        <div class="s">审核队列里等你点</div>
      </div>
      <div class="panel kpi">
        <div class="k">待发 / 真实已发</div>
        <div class="v">${ov.counts.scheduled} <span style="font-size:15px;color:var(--muted)">/ ${ov.counts.published}</span></div>
        <div class="s">测试发送 ${ov.counts.published_test || 0} 条（本地 mock，不算真实发布）</div>
      </div>
      <div class="panel kpi good">
        <div class="k">30 天曝光${ov.counts.demoMetrics ? ' <span class="tag warn">示例</span>' : ''}</div>
        <div class="v">${fmt(met.totals.impressions)}</div>
        <div class="s">${met.totals.posts} 条帖子的累计</div>
      </div>
      <div class="panel kpi">
        <div class="k">互动率${ov.counts.demoMetrics ? ' <span class="tag warn">示例</span>' : ''}</div>
        <div class="v">${pct(met.totals.engagement_rate)}</div>
        <div class="s">点击 ${fmt(met.totals.clicks)} · 引流 ${fmt(met.totals.sessions)}</div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head">
        <h2>平台覆盖 · 重点 4 个平台 / 共 ${plat.platforms.length} 个渠道</h2>
        <span class="hint">点「平台覆盖」看每个平台差什么</span>
      </div>
      ${(() => {
        const focus = ['facebook_page', 'instagram', 'tiktok', 'pinterest'];
        const focusList = focus.map((code) => plat.platforms.find((x) => x.code === code)).filter(Boolean);
        const ready = focusList.filter((p) => p.channel_state === 'ready').length;
        const rest = plat.platforms.filter((p) => !focus.includes(p.code));
        const restBy = (k) => rest.filter((p) => p.kind === k).length;
        return `<div class="muted" style="font-size:12px;margin-bottom:10px">重点 4 个平台：${ready} 个已接通（其余处于待资质/待联调）</div>
        <div class="grid g4">
          ${focusList.map((p) => `<div class="plat-card ${p.channel_state === 'ready' ? 'ready' : 'pending'}">
            <div class="top"><span class="name">${esc(p.label)}</span>${chTag(p.channel_state)}</div>
            <div class="meta"><span>账号 ${p.accounts}</span><span>内容 ${p.contents}</span><span>已发 ${p.published}</span></div>
            <div class="note">${esc(p.channel_note || '')}</div>
          </div>`).join('')}
        </div>
        <details style="margin-top:12px">
          <summary class="muted" style="cursor:pointer;font-size:12px">其余 ${rest.length} 个渠道（社媒 ${restBy('social')} · 论坛 ${restBy('forum')} · B2B ${restBy('b2b')} · 私信 ${restBy('im')}）—— 以后再说</summary>
          <div class="pill-list" style="margin-top:8px">${rest.map((p) => `<span class="tag mute">${esc(p.label)}</span>`).join('')}</div>
        </details>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost tiny" data-go="platforms">查看全部 ${plat.platforms.length} 个渠道</button></div>`;
      })()}
    </div>

    <div class="split" style="margin-top:14px">
      <div class="panel">
        <div class="panel-head"><h2>等你处理</h2><span class="hint">按阻塞程度排</span></div>
        ${pending.length ? `<table><thead><tr><th>内容</th><th>平台</th><th></th></tr></thead><tbody>
          ${pending.slice(0, 6).map((c) => `<tr><td>#${c.id} ${esc((c.title || c.body || '').slice(0, 46))}</td>
            <td><span class="tag info">${esc(pname(c.platform))}</span></td>
            <td><button class="btn ghost tiny" data-go="review">去审核</button></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty">审核队列是空的，去「AI 二创」生成一批</div>`}
        <div style="margin-top:14px">
          <div class="nav-label" style="padding-left:0">缺的东西</div>
          <div class="pill-list">
            ${!ov.gateway.ok ? '<span class="tag bad">模型网关离线</span>' : ''}
            ${!plat.platforms.find((p) => p.code === 'tiktok') ? '' : ''}
            ${met.hasDemo ? '<span class="tag warn">看板含示例数据</span>' : '<span class="tag mute">看板暂无真实数据</span>'}
            <span class="tag mute">Apify 未接</span>
            ${pz.configured ? '<span class="tag ok">Postiz 已配置（去设置页验证连通）</span>' : '<span class="tag mute">Postiz 未连</span>'}
            <span class="tag mute">GA4 未授权</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>模块进度</h2><span class="hint">${led.ledger.filter((x) => x.state === '已跑通').length}/${led.ledger.length} 已跑通</span></div>
        ${led.ledger.slice(0, 8).map((x) => `<div style="display:flex;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line-soft)">
          <span style="flex:1">${esc(x.module)}</span>
          <span class="tag ${x.state === '已跑通' ? 'ok' : x.state === '部分跑通' ? 'warn' : x.state === '待跑通' ? 'info' : 'mute'}">${esc(x.state)}</span>
        </div>`).join('')}
      </div>
    </div>`;

  $$('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
}

/* ================= 平台覆盖 ================= */
async function viewPlatforms() {
  const plat = await api('/api/platforms');
  ST.platforms = plat.platforms;
  const groups = ['social', 'forum', 'b2b', 'im', 'local'];
  const readyN = plat.platforms.filter((p) => p.channel_state === 'ready').length;
  const cfgN = plat.platforms.filter((p) => p.channel_state === 'pending_config').length;
  const connN = plat.platforms.filter((p) => p.channel_state === 'pending_connect').length;

  $('#view').innerHTML = `
    <div class="grid g4">
      <div class="panel kpi"><div class="k">渠道总数</div><div class="v">${plat.platforms.length}</div><div class="s">社媒 ${plat.kinds.social || 0} · 论坛 ${plat.kinds.forum || 0} · B2B ${plat.kinds.b2b || 0} · 私信 ${plat.kinds.im || 0}</div></div>
      <div class="panel kpi good"><div class="k">真实可发</div><div class="v">${readyN}</div><div class="s">凭据在手且服务在线才计入</div></div>
      <div class="panel kpi warn"><div class="k">缺配置 / 连不上</div><div class="v">${cfgN} <span style="font-size:15px;color:var(--muted)">/ ${connN}</span></div><div class="s">左：填 Token / URL 就通 · 右：配了但服务连不上</div></div>
      <div class="panel kpi"><div class="k">需平台资质</div><div class="v">${plat.platforms.filter((p) => p.channel_state === 'pending_api').length}</div><div class="s">开发者审核 / 企业验证</div></div>
    </div>

    ${groups.map((g) => {
      const list = plat.platforms.filter((p) => p.kind === g);
      if (!list.length) return '';
      return `<div class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>${KIND[g] || g} · ${list.length}</h2></div>
        <table class="plat-table">
          <thead><tr><th>平台</th><th>通道状态</th><th>账号</th><th>内容</th><th>已发</th><th>差什么 / 说明</th><th></th></tr></thead>
          <tbody>${list.map((p) => `<tr>
            <td><strong>${esc(p.label)}</strong><div class="mono muted" style="font-size:11px">${esc(p.code)}</div></td>
            <td>${chTag(p.channel_state)}</td>
            <td class="num">${p.accounts}</td><td class="num">${p.contents}</td><td class="num">${p.published}</td>
            <td class="muted">${esc(p.state_note || p.channel_note || '')}${p.state_live && p.channel_note && p.state_note && p.state_note !== p.channel_note ? `<div class="muted" style="font-size:11px;opacity:.65">${esc(p.channel_note)}</div>` : ''}</td>
            <td>${p.hosted_by === 'postiz'
              ? `<a class="btn ghost tiny" href="https://platform.postiz.com" target="_blank" rel="noreferrer" title="账号在 Postiz 后台 Channels 里连，工作台只读 /integrations 拿 integration_id，本地不用再建账号行">去 Postiz 授权</a>`
              : `<button class="btn ghost tiny" data-add-acc="${esc(p.code)}">加账号</button>`}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }).join('')}

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>通道状态含义</h2></div>
      <div class="grid g3">
        <div><span class="tag ok">已跑通</span><p class="muted" style="font-size:11.5px">凭据在、上游探测通过，点排期就真发（Bluesky 已实测发过公开帖）</p></div>
        <div><span class="tag mute">本地模拟</span><p class="muted" style="font-size:11.5px">mock 通道，只写本地库，不算真实发布</p></div>
        <div><span class="tag warn">填配置即通</span><p class="muted" style="font-size:11.5px">填 Token / 实例域名 / 接收端 URL 就能发，不需要平台审核</p></div>
        <div><span class="tag warn">待填 Key</span><p class="muted" style="font-size:11.5px">Postiz 已连通，但 API Key 无效或已撤销：去 Postiz → Settings → API Keys 重新复制一条；账号不在这台机器上建，去 platform.postiz.com 的 Channels 连</p></div>
        <div><span class="tag warn">待 Postiz 联调</span><p class="muted" style="font-size:11.5px">Postiz 已连通，但这个平台还没在 Postiz 后台授权通道</p></div>
        <div><span class="tag warn">服务没连上</span><p class="muted" style="font-size:11.5px">请求根本没到上游（DNS / 端口 / 反代 404 / 超时）；云版填 https://api.postiz.com 时基本只会是网络问题</p></div>
        <div><span class="tag warn">缺素材</span><p class="muted" style="font-size:11.5px">平台只收图文/视频（IG、TikTok、YouTube、Pinterest），这条内容没有配图，先去图库生成或上传</p></div>
        <div><span class="tag mute">待平台资质</span><p class="muted" style="font-size:11.5px">平台侧要开发者账号、App 审核或商业验证；走 Postiz 云版时这层由 Postiz 代办</p></div>
        <div><span class="tag info">需浏览器会话</span><p class="muted" style="font-size:11.5px">无发布 API，只能真实账号会话操作，封号风险中高</p></div>
        <div><span class="tag mute">只能人工</span><p class="muted" style="font-size:11.5px">平台没有公开接口，工具只做提醒与素材准备</p></div>
      </div>
    </div>`;

  $$('[data-add-acc]').forEach((b) => (b.onclick = () => {
    ST.presetPlatform = b.dataset.addAcc;
    go('accounts');
  }));
}

/* ================= 数据看板 ================= */
async function viewAnalytics() {
  const [m, pending] = await Promise.all([api('/api/metrics/overview?days=' + ST.days), api('/api/metrics/pending')]);
  const t = m.totals;
  const rows = pending.posts;

  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>发布后跟踪</h2>
        <div class="row tight">
          ${[7, 14, 30, 90].map((d) => `<button class="btn ${ST.days === d ? 'primary' : 'ghost'} tiny" data-days="${d}">${d} 天</button>`).join('')}
          <button class="btn ghost tiny" id="demo-load">导入示例数据</button>
          ${m.hasDemo ? '<button class="btn danger tiny" id="demo-clear">清除示例</button>' : ''}
        </div>
      </div>
      ${m.hasDemo ? '<div class="tag warn" style="margin-bottom:12px">当前看板包含示例数据（source=demo），只用于验证图表；真实数据从下面「回收指标」录入或从 Postiz/GA4 拉取</div>' : ''}
      <div class="grid g6">
        <div class="panel kpi" style="padding:12px 14px"><div class="k">曝光</div><div class="v" style="font-size:22px">${fmt(t.impressions)}</div></div>
        <div class="panel kpi" style="padding:12px 14px"><div class="k">互动</div><div class="v" style="font-size:22px">${fmt(t.engagements)}</div></div>
        <div class="panel kpi good" style="padding:12px 14px"><div class="k">互动率</div><div class="v" style="font-size:22px">${pct(t.engagement_rate)}</div></div>
        <div class="panel kpi" style="padding:12px 14px"><div class="k">点击</div><div class="v" style="font-size:22px">${fmt(t.clicks)}</div><div class="s">CTR ${pct(t.ctr)}</div></div>
        <div class="panel kpi" style="padding:12px 14px"><div class="k">引流会话</div><div class="v" style="font-size:22px">${fmt(t.sessions)}</div></div>
        <div class="panel kpi warn" style="padding:12px 14px"><div class="k">询盘数</div><div class="v" style="font-size:22px">${fmt(t.inquiries || 0)}</div><div class="s">手动回填，后续接 GA4 generate_lead</div></div>
      </div>
    </div>
    <div class="subnav" id="an-tabs" style="margin-top:14px">
      <button data-an="overview" class="on">趋势</button>
      <button data-an="platforms">平台对比</button>
      <button data-an="posts">帖子排行</button>
      <button data-an="recover">指标回收</button>
    </div>

    <div class="split an-sec" data-sec="overview" style="margin-top:14px">
      <div class="panel">
        <div class="panel-head"><h2>趋势（${m.days} 天）</h2><span class="hint">${m.rows} 条日记录 · 两张图各自量程</span></div>
        <div class="chart-wrap sm"><canvas id="chart-imp"></canvas></div>
        <div class="chart-legend"><span><i style="background:#4f8cff"></i>曝光</span></div>
        <div class="chart-wrap sm" style="margin-top:12px"><canvas id="chart-eng"></canvas></div>
        <div class="chart-legend"><span><i style="background:#34d399"></i>互动（赞+评+分享+收藏）</span></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>平台对比 · 曝光</h2></div>
        <div class="chart-wrap"><canvas id="chart-bar"></canvas></div>
      </div>
    </div>
    <div class="panel an-sec" data-sec="platforms" style="margin-top:14px;display:none">
      <div class="panel-head"><h2>平台表现</h2><span class="hint">按曝光排序</span></div>
      ${m.by_platform.length ? `<table><thead><tr><th>平台</th><th>帖子</th><th>曝光</th><th>互动</th><th>互动率</th><th>点击</th><th>引流</th><th>询盘</th></tr></thead><tbody>
        ${m.by_platform.map((pp) => `<tr><td>${esc(pname(pp.platform))}</td><td class="num">${pp.posts}</td>
          <td class="num">${fmt(pp.impressions)}</td><td class="num">${fmt(pp.engagements)}</td>
          <td class="num">${pct(pp.engagement_rate)}</td><td class="num">${fmt(pp.clicks)}</td><td class="num">${fmt(pp.sessions)}</td><td class="num">${fmt(pp.inquiries || 0)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有指标数据</div>'}
    </div>

    <div class="panel an-sec" data-sec="posts" style="margin-top:14px;display:none">
      <div class="panel-head"><h2>帖子排行</h2><span class="hint">按互动量</span></div>
      ${m.top_posts.length ? `<table><thead><tr><th>内容</th><th>平台</th><th>曝光</th><th>互动</th><th>互动率</th><th>点击</th><th>引流</th><th>询盘</th></tr></thead><tbody>
        ${m.top_posts.map((p) => `<tr><td>#${p.content_id} ${esc((p.title || '').slice(0, 40))}</td>
          <td><span class="tag info">${esc(pname(p.platform))}</span></td>
          <td class="num">${fmt(p.impressions)}</td><td class="num">${fmt(p.engagements)}</td>
          <td class="num">${pct(p.engagement_rate)}</td><td class="num">${fmt(p.clicks)}</td>
          <td class="num">${fmt(p.sessions)}</td><td class="num">${fmt(p.inquiries || 0)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有指标数据。发布一条内容后在这里回填曝光/互动，或先导入示例看图表</div>'}
    </div>

    <div class="panel an-sec" data-sec="recover" style="margin-top:14px;display:none">
      <div class="panel-head"><h2>回收指标</h2><span class="hint">已发布/已通过的内容，按天回填</span></div>
      ${rows.length ? `<table><thead><tr><th>内容</th><th>平台</th><th>已填</th><th>最近</th></tr></thead><tbody>
        ${rows.slice(0, 8).map((p) => `<tr>
          <td>#${p.id} ${esc((p.title || p.excerpt || '').slice(0, 42))}</td>
          <td><span class="tag info">${esc(pname(p.platform))}</span></td>
          <td class="num">${p.metric_days} 天</td><td class="muted mono">${esc(p.last_day || '—')}</td>
        </tr>`).join('')}
      </tbody></table>
      <div class="row" style="margin-top:14px">
        <div class="field" style="flex:1;min-width:240px"><label>内容</label>
          <select id="mx-content">${rows.map((p) => `<option value="${p.id}">#${p.id} ${esc(p.platform)} · ${esc((p.title || p.excerpt || '').slice(0, 28))}</option>`).join('')}</select>
        </div>
        <div class="field"><label>日期</label><input type="date" id="mx-day" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field" style="max-width:100px"><label>曝光</label><input id="mx-imp" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:90px"><label>点赞</label><input id="mx-like" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:90px"><label>评论</label><input id="mx-cmt" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:90px"><label>分享</label><input id="mx-share" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:90px"><label>收藏</label><input id="mx-save" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:100px"><label>点击</label><input id="mx-click" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:110px"><label>引流会话</label><input id="mx-sess" type="number" min="0" value="0" /></div>
        <div class="field" style="max-width:100px"><label>询盘数</label><input id="mx-inq" type="number" min="0" value="0" /></div>
        <button class="btn primary" id="mx-save-btn">保存这一天的数据</button>
      </div>` : '<div class="empty">还没有可跟踪的内容，先发布或通过一条</div>'}
    </div>`;

  $$('#an-tabs [data-an]').forEach((b) => (b.onclick = () => {
    $$('#an-tabs [data-an]').forEach((x) => x.classList.toggle('on', x === b));
    $$('.an-sec').forEach((sec) => (sec.style.display = sec.dataset.sec === b.dataset.an ? '' : 'none'));
  }));
  drawLine($('#chart-imp'), m.series, [{ key: 'impressions', color: '#4f8cff', area: true }]);
  drawLine($('#chart-eng'), m.series, [{ key: 'engagements', color: '#34d399', area: true, areaFrom: 'rgba(52,211,153,.26)' }]);
  const labelMap = Object.fromEntries((ST.platforms || []).map((p) => [p.code, p.label]));
  drawBars($('#chart-bar'), m.by_platform.map((p) => ({ ...p, plabel: labelMap[p.platform] || p.platform })), 'plabel', 'impressions');

  $$('[data-days]').forEach((b) => (b.onclick = () => { ST.days = Number(b.dataset.days); viewAnalytics(); }));
  const dl = $('#demo-load');
  if (dl) dl.onclick = async () => {
    try { const r = await api('/api/metrics/demo', 'POST'); toast(`已导入 ${r.rows} 条示例数据`); viewAnalytics(); }
    catch (e) { toast(e.message, true); }
  };
  const dc = $('#demo-clear');
  if (dc) dc.onclick = async () => {
    try { const r = await api('/api/metrics/demo', 'DELETE'); toast(`已清除 ${r.removed} 条示例`); viewAnalytics(); }
    catch (e) { toast(e.message, true); }
  };
  const sv = $('#mx-save-btn');
  if (sv) sv.onclick = async () => {
    try {
      await api('/api/metrics', 'POST', {
        content_id: Number($('#mx-content').value), day: $('#mx-day').value,
        impressions: $('#mx-imp').value, likes: $('#mx-like').value, comments: $('#mx-cmt').value,
        shares: $('#mx-share').value, saves: $('#mx-save').value, clicks: $('#mx-click').value, sessions: $('#mx-sess').value, inquiries: $('#mx-inq').value,
      });
      toast('已保存'); viewAnalytics();
    } catch (e) { toast(e.message, true); }
  };
}

/* ================= 爆款库 ================= */
async function viewHotspots() {
  const [{ hotspots }, kw, src] = await Promise.all([api('/api/hotspots'), api('/api/keywords'), api('/api/discover/sources')]);
  const res = ST.disc || [];
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2>按关键词找爆款</h2>
        <span class="hint">视频是真实播放量；文章只有标题/来源/时间，分数为估算</span>
      </div>
      <div class="field"><label>关键词（点选，可多选，最多 10 个）</label>
        <div class="pill-list" style="padding-top:4px">
          ${kw.keywords.map((k) => `<label class="tag info" style="cursor:pointer"><input type="checkbox" class="d-kw" value="${esc(k)}" style="width:auto;margin-right:6px;vertical-align:middle" />${esc(k)}</label>`).join('')}
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div class="field" style="flex:1;min-width:260px"><label>额外关键词（英文逗号分隔）</label><input id="d-extra" placeholder="custom packaging box, kraft mailer" /></div>
        <div class="field" style="flex:1;min-width:300px"><label>来源</label>
          <div class="pill-list" style="padding-top:4px">
            ${src.sources.map((s) => `<label class="tag ${s.configured ? '' : 'mute'}" style="cursor:${s.configured ? 'pointer' : 'not-allowed'}" title="${esc(s.note)}">
              <input type="checkbox" class="d-src" value="${s.key}" ${s.configured && (s.key === 'youtube' || s.key === 'gnews') ? 'checked' : ''} ${s.configured ? '' : 'disabled'} style="width:auto;margin-right:6px;vertical-align:middle" />${esc(s.label)}</label>`).join('')}
          </div>
        </div>
        <div class="field" style="max-width:104px"><label>每词条数</label><input id="d-per" type="number" value="5" min="1" max="10" /></div>
        <div class="field" style="max-width:104px"><label>最低分</label><input id="d-min" type="number" value="0" min="0" max="100" /></div>
        <button class="btn primary" id="d-run">搜索</button>
        <span class="muted" id="d-status"></span>
      </div>
      <div id="d-out" style="margin-top:14px">${renderDisc(res)}</div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>手动粘贴一条</h2><span class="hint">搜不到的帖子/文章直接贴进来</span></div>
      <div class="row">
        <div class="field"><label>平台</label><select id="h-platform">${ST.platforms.map((p) => `<option value="${p.code}">${esc(p.label)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1;min-width:250px"><label>链接</label><input id="h-url" placeholder="https://..." /></div>
        <div class="field" style="flex:1;min-width:220px"><label>标题 / 开场</label><input id="h-title" /></div>
        <div class="field"><label>关键词</label><input id="h-kw" placeholder="packaging" /></div>
        <button class="btn ghost" id="h-add">入库</button>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>爆款库 · ${hotspots.length}</h2><span class="hint">分数高→优先二创；点「去二创」直接带到生成页</span></div>
      ${hotspots.length ? `<table><thead><tr><th>#</th><th>类型</th><th>平台/来源</th><th>标题</th><th>数据</th><th>分</th><th>结构</th><th></th></tr></thead><tbody>
        ${hotspots.map((h) => {
          let st = {};
          try { st = JSON.parse(h.stats || '{}'); } catch {}
          const metric = st.views ? `${fmt(st.views)} 播放` : (st.outlet ? esc(st.outlet) : '—');
          return `<tr>
            <td class="mono">${h.id}</td>
            <td>${h.kind === 'video' ? '<span class="tag info">视频</span>' : h.kind === 'article' ? '<span class="tag mute">文章</span>' : '<span class="tag mute">帖子</span>'}</td>
            <td>${esc(pname(h.platform) || h.platform)}<div class="muted" style="font-size:11px">${esc(h.keyword)}</div></td>
            <td><a href="${esc(h.url)}" target="_blank" rel="noreferrer">${esc((h.title || h.url).slice(0, 60))}</a>
              <div class="muted" style="font-size:11px">${esc(h.author || '')} ${h.published ? '· ' + esc(h.published) : ''}</div></td>
            <td class="muted">${metric}</td>
            <td class="num">${h.score || 0}${h.score_type === 'estimated' ? '<div class="tag mute" style="font-size:10px">估</div>' : ''}</td>
            <td>${h.structure && h.structure !== '{}' ? '<span class="tag ok">已拆解</span>' : '<span class="tag mute">未拆解</span>'}</td>
            <td style="white-space:nowrap">
              <button class="btn ghost tiny" data-anlh="${h.id}">分析</button>
              <button class="btn ghost tiny" data-dec="${h.id}">拆解</button>
              <button class="btn ghost tiny" data-togen="${h.id}">去二创</button>
              <button class="btn danger tiny" data-delh="${h.id}">删</button>
            </td></tr>`;
        }).join('')}
      </tbody></table>` : '<div class="empty">爆款库是空的。上面按关键词搜一批，或手动粘一条</div>'}
      <div id="struct-box"></div>
    </div>`;

  $('#d-run').onclick = async () => {
    const picked = $$('.d-kw').filter((x) => x.checked).map((x) => x.value);
    const extra = ($('#d-extra').value || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const keywords = [...new Set([...picked, ...extra])].slice(0, 10);
    const sources = $$('.d-src').filter((x) => x.checked && !x.disabled).map((x) => x.value);
    if (!keywords.length) return toast('至少勾一个关键词或填一个', true);
    if (!sources.length) return toast('至少选一个来源', true);
    $('#d-run').disabled = true;
    $('#d-status').textContent = `搜索中：${keywords.length} 个词 × ${sources.length} 个来源…`;
    try {
      const r = await api('/api/discover', 'POST', { keywords, sources, per: Number($('#d-per').value || 5), min_score: Number($('#d-min').value || 0) });
      ST.disc = r.items;
      ST.discMeta = { keywords, sources, errors: r.errors };
      toast(`找到 ${r.count} 条`);
      viewHotspots();
    } catch (e) {
      toast(e.message, true);
      $('#d-run').disabled = false;
      $('#d-status').textContent = '';
    }
  };

  const allBtn = $('#d-all');
  if (allBtn) allBtn.onclick = () => {
    const boxes = $$('.d-pick');
    const on = boxes.length > 0 && boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !on));
  };
  const saveBtn = $('#d-save');
  if (saveBtn) saveBtn.onclick = async () => {
    const picked = $$('.d-pick').filter((b) => b.checked).map((b) => res[Number(b.dataset.i)]);
    if (!picked.length) return toast('先勾选要入库的条目', true);
    try {
      const r = await api('/api/hotspots/bulk', 'POST', { items: picked });
      ST.disc = [];
      toast(`已入库 ${r.count} 条`);
      viewHotspots();
    } catch (e) { toast(e.message, true); }
  };

  $('#h-add').onclick = async () => {
    try {
      await api('/api/hotspots', 'POST', { platform: $('#h-platform').value, url: $('#h-url').value, title: $('#h-title').value, keyword: $('#h-kw').value });
      toast('已入库'); viewHotspots();
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-dec]').forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = '拆解中…';
    try {
      const r = await api(`/api/hotspots/${b.dataset.dec}/deconstruct`, 'POST');
      $('#struct-box').innerHTML = `<div class="panel-head" style="margin-top:16px"><h2>结构拆解</h2><span class="hint">${esc(r.via)}</span></div><div class="pre mono">${esc(JSON.stringify(r.structure, null, 2))}</div>`;
      toast('拆解完成');
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = '拆解';
  }));
  $$('[data-anlh]').forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = '分析中…';
    try {
      const r = await api('/api/analyze', 'POST', { target_kind: 'hotspot', target_id: Number(b.dataset.anlh) });
      $('#struct-box').innerHTML = '<div class="panel-head" style="margin-top:16px"><h2>AI 分析 · 为什么火</h2><span class="hint">' + esc(r.via || '') + '</span></div>' + renderHotspotAnalysis(r.analysis);
      toast('分析完成');
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = '分析';
  }));
  $$('[data-togen]').forEach((b) => (b.onclick = () => { ST.presetHotspot = Number(b.dataset.togen); go('generate'); }));
  $$('[data-delh]').forEach((b) => (b.onclick = async () => { await api(`/api/hotspots/${b.dataset.delh}`, 'DELETE'); toast('已删除'); viewHotspots(); }));
}

function renderDisc(res) {
  if (!res || !res.length) return '<div class="empty">还没有搜索结果。勾关键词 → 选来源 → 搜索</div>';
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="muted" style="font-size:11.5px">${res.length} 条结果，按分数排序</span>
      <div class="row tight">
        <button class="btn ghost tiny" id="d-all">全选 / 反选</button>
        <button class="btn primary tiny" id="d-save">入库选中</button>
      </div>
    </div>
    <table><thead><tr><th style="width:32px"></th><th>类型</th><th>标题</th><th>来源/作者</th><th>数据</th><th>时间</th><th>分</th><th>关键词</th></tr></thead><tbody>
    ${res.map((it, i) => `<tr>
      <td><input type="checkbox" class="d-pick" data-i="${i}" style="width:auto" /></td>
      <td>${it.kind === 'video' ? '<span class="tag info">视频</span>' : '<span class="tag mute">文章</span>'}</td>
      <td><a href="${esc(it.url)}" target="_blank" rel="noreferrer">${esc((it.title || '').slice(0, 70))}</a>
        ${it.snippet ? `<div class="muted" style="font-size:11px">${esc(it.snippet.slice(0, 90))}</div>` : ''}</td>
      <td class="muted">${esc(it.author || '')}</td>
      <td class="num">${it.stats && it.stats.views ? fmt(it.stats.views) + ' 播放' : '—'}</td>
      <td class="muted mono">${it.days >= 999 ? '—' : it.days + ' 天前'}</td>
      <td class="num">${it.score}${it.score_type === 'estimated' ? ' <span class="tag mute" style="font-size:10px">估</span>' : ''}</td>
      <td class="muted">${esc(it.keyword || '')}</td>
    </tr>`).join('')}
    </tbody></table>`;
}
/* ================= 产品 ================= */
async function viewProducts() {
  const { products } = await api('/api/products');
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>新增产品</h2><span class="hint">卖点写清楚，AI 二创直接引用</span></div>
      <div class="row">
        <div class="field"><label>SKU</label><input id="p-sku" placeholder="PK-001" /></div>
        <div class="field" style="flex:1"><label>产品名</label><input id="p-name" placeholder="Custom Kraft Mailer Box" /></div>
        <div class="field"><label>目标市场</label><input id="p-market" value="欧美" /></div>
        <div class="field" style="flex:1"><label>落地页</label><input id="p-url" placeholder="https://packrivo.com/..." /></div>
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field" style="flex:1"><label>卖点</label><textarea id="p-points" placeholder="只写网站上已公开的卖点；尺寸克重没写的留空，别让 AI 编"></textarea></div>
        <div class="field" style="flex:1"><label>参数</label><textarea id="p-params" placeholder="网站已公开的参数才填；没有就留空（交期只能写 1–15 days）"></textarea></div>
      </div>
      <div class="row" style="margin-top:10px">
        <div class="field" style="flex:1"><label>关键词</label><input id="p-kw" placeholder="custom mailer box, kraft packaging" /></div>
        <button class="btn primary" id="p-add">保存</button>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>产品库 · ${products.length}</h2></div>
      ${products.length ? `<table><thead><tr><th>#</th><th>SKU</th><th>名称</th><th>卖点</th><th>市场</th><th></th></tr></thead><tbody>
        ${products.map((p) => `<tr><td class="mono">${p.id}</td><td>${esc(p.sku)}</td><td>${esc(p.name)}</td>
          <td class="muted">${esc((p.selling_points || '').slice(0, 70))}</td><td>${esc(p.target_markets)}</td>
          <td><button class="btn danger tiny" data-delp="${p.id}">删</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有产品</div>'}
    </div>`;

  $('#p-add').onclick = async () => {
    try {
      await api('/api/products', 'POST', {
        sku: $('#p-sku').value, name: $('#p-name').value, selling_points: $('#p-points').value,
        params: $('#p-params').value, target_markets: $('#p-market').value, keywords: $('#p-kw').value, url: $('#p-url').value,
      });
      toast('已保存'); viewProducts();
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-delp]').forEach((b) => (b.onclick = async () => { await api(`/api/products/${b.dataset.delp}`, 'DELETE'); toast('已删除'); viewProducts(); }));
}

/* ================= AI 二创 ================= */
async function viewGenerate() {
  const [{ products }, { hotspots }] = await Promise.all([api('/api/products'), api('/api/hotspots')]);
  if (!products.length) {
    $('#view').innerHTML = '<div class="panel"><div class="empty">先去「产品与素材」录一个产品</div></div>';
    return;
  }
  const groups = ['social', 'forum', 'b2b', 'im'];
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>一稿多平台</h2><span class="hint">不同平台自动换文体：社媒短句、论坛经验帖、B2B 产品描述、私信开场</span></div>
      <div class="row">
        <div class="field" style="flex:1"><label>产品</label><select id="g-product">${products.map((p) => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}</select></div>
        <div class="field" style="flex:1"><label>参考爆款（可选）</label><select id="g-hotspot"><option value="">不用参考</option>${hotspots.map((h) => `<option value="${h.id}" ${ST.presetHotspot === h.id ? 'selected' : ''}>#${h.id} ${esc((h.title || h.url).slice(0, 46))}${h.score ? ' · ' + h.score + '分' : ''}</option>`).join('')}</select></div>
        <div class="field"><label>语言</label><select id="g-lang"><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="ar">العربية</option><option value="pt">Português</option></select></div>
        <div class="field"><label>语气</label><input id="g-tone" value="专业" /></div>
      </div>
      ${groups.map((g) => {
        const list = ST.platforms.filter((p) => p.kind === g);
        if (!list.length) return '';
        return `<div style="margin-top:12px">
          <div class="nav-label" style="padding-left:0">${KIND[g]}</div>
          <div class="pill-list">${list.map((p) => `<label class="tag info" style="cursor:pointer"><input type="checkbox" class="g-plat" value="${p.code}" style="width:auto;margin-right:6px;vertical-align:middle" />${esc(p.label)}</label>`).join('')}</div>
        </div>`;
      }).join('')}
      <div class="row" style="margin-top:14px">
        <div class="pill-list" style="margin-top:10px">
          <label class="tag info" style="cursor:pointer"><input type="checkbox" id="g-genimg" checked style="width:auto;margin-right:6px;vertical-align:middle" />同时生成配图（外部图像 API）</label>
          <label class="tag mute" style="cursor:pointer;opacity:.7" title="需要先配置视频接口（可灵/即梦/Veo）"><input type="checkbox" id="g-genvid" disabled style="width:auto;margin-right:6px;vertical-align:middle" />同时生成短视频（未接）</label>
        </div>
        <button class="btn primary" id="g-run" style="margin-top:10px">生成</button>
        <span class="muted" id="g-status"></span>
      </div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="panel-head"><h2>生成结果</h2></div><div id="g-out" class="empty">还没生成</div></div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>博客转社媒</h2><span class="hint">贴一篇 packrivo.com 博客链接，读标题与要点，生成 3-5 条不同平台的帖子</span></div>
      <div class="row">
        <div class="field" style="flex:2;min-width:320px"><label>博客链接</label><input id="b-url" placeholder="https://www.packrivo.com/blog/..." /></div>
        <button class="btn primary" id="b-run">读取并生成</button>
        <span class="muted" id="b-status"></span>
      </div>
      <div class="pill-list" style="margin-top:10px">
        ${[["facebook_page","Facebook 主页"],["instagram","Instagram"],["tiktok","TikTok"],["pinterest","Pinterest"],["linkedin","LinkedIn"]].map((x, i) => `<label class="tag info" style="cursor:pointer"><input type="checkbox" class="b-plat" value="${x[0]}" ${i < 3 ? "checked" : ""} style="width:auto;margin-right:6px;vertical-align:middle" />${x[1]}</label>`).join("")}
      </div>
      <div id="b-out" style="margin-top:12px"></div>
    </div>`;

  const bRun = $('#b-run');
  if (bRun) bRun.onclick = async () => {
    const url = $('#b-url').value.trim();
    if (!url) return toast('先贴博客链接', true);
    const plats = $$('.b-plat').filter((x) => x.checked).map((x) => x.value);
    if (!plats.length) return toast('至少选一个平台', true);
    bRun.disabled = true; $('#b-status').textContent = '读取博客 → 生成中…（每个平台一次模型调用）';
    try {
      const r = await api('/api/blog/import', 'POST', { url, platforms: plats });
      $('#b-out').innerHTML = '<div class="tag ok">已生成 ' + r.created.length + ' 条</div><div class="muted" style="margin-top:6px">来源：《' + esc(r.source.title) + '》 · 小标题 ' + r.source.headings.length + ' 个 · 要点段落 ' + r.source.paragraphs + ' 段</div>' +
        '<table style="margin-top:10px"><thead><tr><th>#</th><th>平台</th><th>状态</th><th>配图</th></tr></thead><tbody>' + r.created.map((x) => '<tr><td class="mono">' + x.id + '</td><td>' + esc(pname(x.platform)) + '</td><td><span class="tag warn">待审核</span></td><td><button class="btn ghost tiny" data-imgprompt="' + x.id + '">生成提示词</button></td></tr>').join('') + '</tbody></table>' +
        (r.errors.length ? '<div class="tag bad" style="margin-top:8px">失败：' + r.errors.map((e) => esc(e.platform + ': ' + e.error)).join('；') + '</div>' : '');
      toast('已生成 ' + r.created.length + ' 条，进审核队列');
    } catch (e) { toast(e.message, true); }
    bRun.disabled = false; $('#b-status').textContent = '';
  };
  if (ST.presetHotspot) {
    const presetId = ST.presetHotspot;
    const src = hotspots.find((h) => h.id === presetId);
    if (src) {
      const box = document.querySelector('.g-plat[value="' + src.platform + '"]');
      if (box) box.checked = true;
      const note = $('#g-hotspot');
      if (note) note.value = String(presetId);
    }
    ST.presetHotspot = null;
  }

  $('#g-run').onclick = async () => {
    const plats = $$('.g-plat').filter((x) => x.checked).map((x) => x.value);
    if (!plats.length) return toast('至少选一个平台', true);
    $('#g-run').disabled = true;
    $('#g-status').textContent = `生成中：${plats.length} 个平台，逐个调用模型…`;
    try {
      const r = await api('/api/content/generate', 'POST', {
        product_id: Number($('#g-product').value),
        hotspot_id: $('#g-hotspot').value ? Number($('#g-hotspot').value) : null,
        platforms: plats, lang: $('#g-lang').value, tone: $('#g-tone').value,
      });
      $('#g-out').innerHTML = `<table><thead><tr><th>#</th><th>平台</th><th>相似度</th><th>模型</th><th>配图</th></tr></thead><tbody>
        ${r.created.map((c) => `<tr><td class="mono">${c.id}</td><td>${esc(c.platform)}</td>
          <td>${c.similarity == null ? '<span class="tag mute">无参考</span>' : c.similarity > 25 ? `<span class="tag bad">${c.similarity}%</span>` : `<span class="tag ok">${c.similarity}%</span>`}</td>
          <td class="muted">${esc(c.via)}</td>
          <td><button class="btn ghost tiny" data-genimg="${c.id}">生成配图</button></td></tr>`).join('')}
      </tbody></table>
      ${(r.errors || []).length ? `<div class="tag bad" style="margin-top:10px">${r.errors.length} 个平台失败：${r.errors.map((e) => esc(e.platform + ': ' + e.error)).join('；')}</div>` : ''}
      <p class="muted" style="margin-top:10px">已进入审核队列</p>`;
      toast(`生成 ${r.created.length} 条`);
    } catch (e) { toast(e.message, true); }
    $('#g-run').disabled = false;
    $('#g-status').textContent = '';
  };
}

/* ================= 审核 ================= */
async function viewReview() {
  const [{ contents }, { accounts }, approvedRes] = await Promise.all([
    api('/api/contents?status=pending_review'),
    api('/api/accounts'),
    api('/api/contents?status=approved').catch(() => ({ contents: [] })),
  ]);
  // UI-02：通过之后这条内容就从待审列表里消失了，原来没有任何入口能替它排期。
  // 已通过 = 批准版本与当前版本一致，这里只列这类，改过图的会在服务端被 bump 掉、自然掉出列表。
  const approved = (approvedRes.contents || []).filter((c) => Number(c.approved_version || 0) > 0 && Number(c.approved_version) === Number(c.content_version || 0));
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>待审 · ${contents.length}</h2><div class="row tight"><span class="hint">含价格/承诺/认证/案例/联系方式的稿子必须人工点通过</span><button class="btn ghost tiny" data-batch-img>批量配图</button></div></div>
      <div id="batch-out" class="muted" style="font-size:12.5px;margin-bottom:8px"></div>
      ${contents.length ? contents.map((c) => `
        <details class="rv-card">
          <summary>
            <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:nowrap">
              <div class="row tight" style="align-items:center;min-width:0;flex:1">
                <span class="tag info">${esc(pname(c.platform))}</span>
                <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.title || (c.body || '').slice(0, 60) || '(无标题)')}</strong>
                <span class="muted" style="font-size:12px;white-space:nowrap">#${c.id} · ${esc(c.lang)}${c.similarity != null ? ' · 相似度 ' + c.similarity + '%' : ''}</span>
              </div>
              <div class="row tight" style="flex-shrink:0">
                <button class="btn ghost tiny" data-ai="${c.id}">AI 预审</button>
                <button class="btn ghost tiny" data-anlc="${c.id}">AI 分析</button>
                <button class="btn ghost tiny" data-imgprompt="${c.id}">配图提示词</button>
                <button class="btn ghost tiny" data-ok="${c.id}">通过</button>
                <button class="btn danger tiny" data-no="${c.id}">打回</button>
              </div>
            </div>
          </summary>
          <div class="rv-body">
            ${c.image_path ? `<img src="/api/media/${esc(String(c.image_path).split(/[\\/]/).pop())}" style="max-width:320px;border-radius:10px;margin-bottom:10px" />` : ''}
            <div class="pre">${esc(c.body)}</div>
            <div data-anlout="${c.id}" style="display:none"></div>
            <div class="muted" style="margin-top:8px;font-size:12px">标签 ${esc(c.hashtags || '—')} · UTM <span class="mono">${esc(c.utm_url)}</span></div>
            <div class="row" style="margin-top:10px">
              <div class="field"><label>发到账号</label><select data-acc="${c.id}">${accounts.some((a) => a.platform === c.platform) ? "" : `<option value="" selected disabled>⚠ 还没有 ${esc(c.platform)} 账号，先去「账号」页添加</option>`}${accounts.map((a) => `<option value="${a.id}" ${a.platform === c.platform ? 'selected' : ''}>${esc(pname(a.platform))} / ${esc(a.handle)}</option>`).join('')}</select></div>
              <div class="field"><label>时间</label><input type="datetime-local" data-when="${c.id}" /></div>
              <button class="btn ghost tiny" data-sch="${c.id}">排期</button>
            </div>
            <div class="pre mono" data-aio="${c.id}" style="display:none;margin-top:10px"></div>
          </div>
        </details>`).join('') : '<div class="empty">队列是空的，去「AI 二创」生成一批</div>'}
    </div>
    <div class="panel">
      <div class="panel-head"><h2>已通过 · 待排期 · ${approved.length}</h2><span class="hint">通过后不会自己发；在这里选账号和时间才会进排期队列</span></div>
      ${approved.length ? `<table><thead><tr><th>#</th><th>平台</th><th>标题</th><th>版本</th><th style="width:220px">发到账号</th><th style="width:200px">时间</th><th></th></tr></thead><tbody>
        ${approved.map((c) => `<tr>
          <td class="mono">${c.id}</td>
          <td><span class="tag info">${esc(pname(c.platform))}</span></td>
          <td>${esc((c.title || (c.body || '').slice(0, 48) || '(无标题)'))}</td>
          <td class="mono">v${esc(String(c.content_version || 1))}</td>
          <td><select data-acc2="${c.id}">${accounts.some((a) => a.platform === c.platform) ? '' : `<option value="" selected disabled>⚠ 没有 ${esc(c.platform)} 账号</option>`}${accounts.filter((a) => a.platform === c.platform).map((a) => `<option value="${a.id}">${esc(pname(a.platform))} / ${esc(a.handle)}${a.integration_id ? '' : '（未绑 integration）'}</option>`).join('')}</select></td>
          <td><input type="datetime-local" data-when2="${c.id}" /></td>
          <td><button class="btn tiny" data-sch2="${c.id}">排期</button></td>
        </tr>`).join('')}
      </tbody></table>` : '<div class="empty">没有已通过待排期的内容</div>'}
    </div>`;

  $$('[data-imgprompt]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.imgprompt;
    const old = b.textContent;
    b.disabled = true; b.textContent = '生成中…';
    try {
      const r = await api('/api/contents/' + id + '/image-prompt', 'POST', {});
      const txt = 'PROMPT: ' + r.prompt + '\n\nNEGATIVE: ' + (r.negative || '-') + '\nRATIO: ' + r.ratio + '\n用途: ' + (r.alt || '');
      const box = document.createElement('div');
      box.className = 'panel';
      box.style.cssText = 'margin-top:10px;border-color:#2b4a7a';
      box.innerHTML = '<div class="panel-head"><h2>配图提示词 · 内容 #' + id + '</h2><span class="hint">复制到 Midjourney / SD / 即梦 出图</span></div><pre class="pre" style="white-space:pre-wrap">' + esc(txt) + '</pre>';
      const row = document.createElement('div');
      row.className = 'row'; row.style.marginTop = '8px';
      const cp = document.createElement('button');
      cp.className = 'btn tiny'; cp.textContent = '复制';
      cp.onclick = () => { navigator.clipboard.writeText(txt); toast('已复制'); };
      row.appendChild(cp); box.appendChild(row);
      b.closest('.panel') ? b.closest('.panel').appendChild(box) : document.querySelector('#content').appendChild(box);
      toast('提示词已生成');
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = old;
  }));
  $$('[data-ai]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    b.disabled = true; b.textContent = '预审中…';
    try {
      const r = await api(`/api/contents/${b.dataset.ai}/ai-review`, 'POST');
      const box = $(`[data-aio="${b.dataset.ai}"]`);
      box.style.display = 'block';
      box.textContent = JSON.stringify(r.ai, null, 2)
        + (r.sensitive_hits && r.sensitive_hits.length ? `\n\n⚠ 命中敏感项：${r.sensitive_hits.map((h) => h.label + '(' + h.match + ')').join('、')} → 强制人工` : '')
        + (r.applied ? '\n（auto 模式已放行）' : '');
      toast(`AI ${r.ai.score} 分 · ${r.ai.decision}${r.forced_manual ? '（转人工）' : ''}`);
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = 'AI 预审';
  }));
  $$('[data-anlc]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    b.disabled = true; b.textContent = '分析中…';
    try {
      const r = await api('/api/analyze', 'POST', { target_kind: 'content', target_id: Number(b.dataset.anlc) });
      const box = document.querySelector('[data-anlout="' + b.dataset.anlc + '"]');
      box.style.display = 'block';
      box.innerHTML = '<div class="panel" style="background:var(--surface-2);margin-top:10px"><div class="panel-head"><h2>AI 分析 · SEO / GEO</h2><div class="row tight"><span class="hint">' + esc(r.via || '') + '</span><button class="btn tiny" data-rewrite="' + b.dataset.anlc + '">按建议重写</button></div></div>' + renderSeoGeo(r.analysis) + '</div>';
      bindRewrite();
      toast('分析完成');
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = 'AI 分析';
  }));
  function bindRewrite() {
    $$('[data-rewrite]').forEach((btn) => (btn.onclick = async () => {
      const id = btn.dataset.rewrite;
      btn.disabled = true; btn.textContent = '重写中…';
      try {
        const r = await api('/api/contents/' + id + '/rewrite-from-analysis', 'POST', {});
        toast('已按建议重写：新稿 #' + r.id + '（' + r.chars + ' 字符）');
        setTimeout(viewReview, 1200);
      } catch (e) { toast(e.message, true); }
      btn.disabled = false; btn.textContent = '按建议重写';
    }));
  }
  $$('[data-ok]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    try { await api(`/api/contents/${b.dataset.ok}/review`, 'POST', { decision: 'approve', reviewer_kind: 'human' }); toast('已通过'); viewReview(); }
    catch (e) { toast(e.message, true); }
  }));
  $$('[data-no]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    try { await api(`/api/contents/${b.dataset.no}/review`, 'POST', { decision: 'reject', reviewer_kind: 'human', notes: '人工打回' }); toast('已打回'); viewReview(); }
    catch (e) { toast(e.message, true); }
  }));
  $$('[data-sch]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.sch;
    const sel = $(`[data-acc="${id}"]`);
    if (!sel) return toast('先建一个账号', true);
    try {
      await api('/api/schedules', 'POST', { content_id: Number(id), account_id: Number(sel.value), run_at: $(`[data-when="${id}"]`).value || null });
      toast('已排期'); viewReview();
    } catch (e) { toast(e.message, true); }
  }));
  $$('[data-sch2]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.sch2;
    const sel = $(`[data-acc2="${id}"]`);
    if (!sel || !sel.value) return toast('这条没有可用的账号，先去「账号」页添加并绑定 integration', true);
    b.disabled = true;
    try {
      const r = await api('/api/schedules', 'POST', { content_id: Number(id), account_id: Number(sel.value), run_at: $(`[data-when2="${id}"]`).value || null });
      toast('已排期 #' + r.id); viewReview();
    } catch (e) { toast(e.message, true); }
    b.disabled = false;
  }));
}

/* ================= 排期 / 结果 ================= */
async function viewSchedule() {
  const { schedules } = await api('/api/schedules');
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>排期 · ${schedules.length}</h2><span class="hint">按平台限速自动排队</span></div>
      ${schedules.length ? `<table><thead><tr><th>#</th><th>内容</th><th>账号</th><th>通道</th><th>计划时间</th><th>状态</th><th>错误</th><th></th></tr></thead><tbody>
        ${schedules.map((s) => `<tr>
          <td class="mono">${s.id}</td>
          <td>#${s.content_id} ${esc((s.title || '').slice(0, 32))}<div class="muted" style="font-size:11px">${esc(s.content_platform)}</div></td>
          <td>${esc(s.handle)}<div class="muted" style="font-size:11px">${esc(s.account_platform)}</div></td>
          <td>${esc(s.channel)}</td>
          <td class="mono">${esc(s.run_at)}</td>
          <td>${sTag(s.state)}</td>
          <td><button class="btn ghost tiny" data-exp-sch="${s.id}">详情</button></td>
          <td><button class="btn ghost tiny" data-now="${s.id}">现在发</button></td>
        </tr>
        <tr class="sch-detail" id="sch-${s.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">
          <div class="row" style="gap:24px;flex-wrap:wrap">
            <div><div class="nav-label" style="padding-left:0">通道 / 状态</div><span class="mono">${esc(s.channel)}</span> · ${sTag(s.state)}</div>
            <div><div class="nav-label" style="padding-left:0">重试</div><span class="mono">${esc(String(s.retry ?? 0))}</span></div>
            <div style="flex:1;min-width:240px"><div class="nav-label" style="padding-left:0">错误</div><div class="muted" style="font-size:12px;white-space:pre-wrap">${esc(s.last_error || '—')}</div></div>
            <div><div class="nav-label" style="padding-left:0">创建时间</div><span class="mono">${esc(s.created_at || '')}</span></div>
          </div>
        </td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有排期</div>'}
    </div>`;
  $$('[data-exp-sch]').forEach((b) => (b.onclick = () => {
    const row = $('#sch-' + b.dataset.expSch);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '详情' : '收起';
  }));
  $$('[data-now]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    try { await api(`/api/schedules/${b.dataset.now}/run-now`, 'POST'); toast('已触发'); setTimeout(viewSchedule, 3500); }
    catch (e) { toast(e.message, true); }
  }));
}

function sTag(s) {
  const m = { pending: ['warn', '待发'], queued: ['info', '排队'], published: ['ok', '已发'], failed: ['bad', '失败'], retrying: ['warn', '重试'], blocked: ['warn', '被挡下'] };
  const [c, t] = m[s] || ['mute', s];
  return `<span class="tag ${c}">${t}</span>`;
}

async function viewResults() {
  const { results } = await api('/api/results');
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>发布结果 · ${results.length}</h2><div class="row tight"><span class="hint">失败会有归因类别；点「展开」看配图与互动</span><button class="btn ghost tiny" data-sync-bsky>同步互动数据</button></div></div>
      ${results.length ? `<table><thead><tr><th>#</th><th>内容</th><th>平台</th><th>通道</th><th>结果</th><th>帖子</th><th>错误</th><th>时间</th></tr></thead><tbody>
        ${results.map((r) => `<tr class="res-row" data-res="${r.id}">
          <td class="mono">${r.id}</td>
          <td>#${r.content_id} ${esc((r.title || '').slice(0, 26))}</td>
          <td>${esc(pname(r.platform))}</td>
          <td>${esc(r.channel)}</td>
          <td>${r.ok ? '<span class="tag ok">成功</span>' : `<span class="tag bad">${esc(r.error_class || '失败')}</span>`}</td>
          <td class="mono">${esc(r.platform_post_id || '')}</td>
          <td class="mono">${esc(r.at)}</td>
          <td><button class="btn ghost tiny" data-exp="${r.id}">展开</button></td>
        </tr>
        <tr class="res-detail" id="res-${r.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">
          <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">
            ${r.image_path ? `<img src="/api/media/${esc(String(r.image_path).split(/[\\/]/).pop())}" style="width:180px;height:180px;object-fit:cover;border-radius:10px;border:1px solid var(--line)" />` : '<div class="empty" style="width:180px;height:180px">无配图</div>'}
            <div style="flex:1;min-width:280px">
              <div class="nav-label" style="padding-left:0">正文</div>
              <div class="muted" style="font-size:12.5px;white-space:pre-wrap;max-height:120px;overflow:auto">${esc((r.body || '').slice(0, 500))}</div>
              <div class="row" style="gap:16px;margin-top:10px">
                <div><div class="nav-label" style="padding-left:0">互动</div><span class="mono">赞 ${r.likes || 0} · 转 ${r.reposts || 0} · 回 ${r.replies || 0}</span></div>
                <div><div class="nav-label" style="padding-left:0">标签</div><span class="muted" style="font-size:12px">${esc(r.hashtags || '—')}</span></div>
                ${r.url ? `<div><div class="nav-label" style="padding-left:0">帖子</div><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a></div>` : ''}
              </div>
              ${r.detail ? `<div class="muted" style="margin-top:8px;font-size:12px">${esc(r.detail)}</div>` : ''}
            </div>
          </div>
        </td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有排期</div>'}
    </div>`;
  $$('[data-exp-sch]').forEach((b) => (b.onclick = () => {
    const row = $('#sch-' + b.dataset.expSch);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '详情' : '收起';
  }));
  $$('[data-now]').forEach((b) => (b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    try { await api(`/api/schedules/${b.dataset.now}/run-now`, 'POST'); toast('已触发'); setTimeout(viewSchedule, 3500); }
    catch (e) { toast(e.message, true); }
  }));
  $$('[data-exp]').forEach((b) => (b.onclick = () => {
    const row = $('#res-' + b.dataset.exp);
    if (!row) return;
    const open = row.style.display !== 'none';
    row.style.display = open ? 'none' : 'table-row';
    b.textContent = open ? '展开' : '收起';
  }));
  const syncBtn = $('[data-sync-bsky]');
  if (syncBtn) syncBtn.onclick = async () => {
    syncBtn.disabled = true; syncBtn.textContent = '同步中…';
    try {
      const r = await api('/api/metrics/sync-bsky', 'POST', {});
      toast('已同步 ' + r.updated + ' 条互动数据');
      setTimeout(viewResults, 900);
    } catch (e) { toast(e.message, true); }
    syncBtn.disabled = false; syncBtn.textContent = '同步互动数据';
  };
  // 默认展开最新一条，直接看到配图与互动
  const firstExp = document.querySelector('[data-exp]');
  if (firstExp) firstExp.click();
}

function sTag(s) {
  const m = { pending: ['warn', '待发'], queued: ['info', '排队'], published: ['ok', '已发'], failed: ['bad', '失败'], retrying: ['warn', '重试'], blocked: ['warn', '被挡下'] };
  const [c, t] = m[s] || ['mute', s];
  return `<span class="tag ${c}">${t}</span>`;
}




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
    return `<g class="gnode" data-go="${n.go}" style="cursor:pointer">
      <rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="12" fill="var(--surface-2)" stroke="${stroke}" stroke-width="1.5" />
      <text x="${p.x + 14}" y="${p.y + 30}" fill="var(--text)" font-size="15" font-weight="600">${esc(n.label)}</text>
      <text x="${p.x + 14}" y="${p.y + 56}" fill="var(--muted)" font-size="12">${esc(n.hint || '')}</text>
      <text x="${p.x + W - 14}" y="${p.y + 30}" text-anchor="end" fill="${stroke}" font-size="20" font-weight="700">${n.count}</text>
    </g>`;
  }).join('');

  const svgEdges = g.edges.map((e) => {
    const a1 = pos[e.from], b1 = pos[e.to];
    if (!a1 || !b1) return '';
    if (e.kind === 'flow') {
      const x1 = a1.x + W, y1 = a1.y + H / 2;
      const x2 = b1.x, y2 = b1.y + H / 2;
      const mx = (x1 + x2) / 2;
      const sameRow = Math.abs(a1.y - b1.y) < 5;
      const d = sameRow ? `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` : `M${a1.x + W / 2},${a1.y + H} C${a1.x + W / 2},${a1.y + H + GY / 2} ${b1.x + W / 2},${b1.y - GY / 2} ${b1.x + W / 2},${b1.y}`;
      return `<path d="${d}" fill="none" stroke="var(--line)" stroke-width="1.6" marker-end="url(#arrow)" />`;
    }
    if (e.kind === 'reject') {
      const x1 = a1.x + W / 2, y1 = a1.y;
      const x2 = b1.x + W / 2, y2 = b1.y + H;
      return `<path d="M${x1},${y1} C${x1},${y1 - 60} ${x2},${y2 + 60} ${x2},${y2}" fill="none" stroke="#c08a2e" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#arrow2)" />
        <text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 8}" fill="#c08a2e" font-size="11" text-anchor="middle">${esc(e.label)}</text>`;
    }
    const x1 = a1.x + W / 2, y1 = a1.y + H;
    const x2 = b1.x + W / 2, y2 = b1.y + H;
    return `<path d="M${x1},${y1} C${x1},${y1 + 40} ${x2},${y2 + 40} ${x2},${y2}" fill="none" stroke="#4a6fa5" stroke-width="1.2" stroke-dasharray="4 4" marker-end="url(#arrow2)" opacity="0.7" />`;
  }).join('');

  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>链路图</h2><span class="hint">每个方块是链路的一环，数字是当前数量；点方块跳到对应页面 · 情报快照 ${esc(g.at || '还没抓过')}</span></div>
      <div style="overflow:auto">
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="max-width:100%">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--line)" />
            </marker>
            <marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#c08a2e" />
            </marker>
          </defs>
          ${svgEdges}
          ${svgNodes}
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
          ${g.nodes.map((n) => `<tr>
            <td>${esc(n.label)}</td>
            <td class="num">${n.count}</td>
            <td class="muted">${esc(n.hint || '')}</td>
            <td><button class="btn ghost tiny" data-go="${n.go}">去做</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

}

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
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>固定工作流 · 七步</h2><span class="hint">每天照着走；每步都有实时数字，卡在哪一步一眼看到</span></div>
      <div class="grid g4" style="margin-bottom:14px">
        <div class="panel kpi"><div class="k">情报池</div><div class="v">${stat.radar}</div><div class="s">视频 ${c.videos} · 帖子 ${c.posts} · 文章 ${c.articles} · 商品 ${c.products_scraped}</div></div>
        <div class="panel kpi"><div class="k">待审稿</div><div class="v">${c.pending}</div><div class="s">已通过 ${c.approved} · 已打回 ${c.rejected}</div></div>
        <div class="panel kpi"><div class="k">排期中</div><div class="v">${c.scheduled}</div><div class="s">真实已发 ${c.published} · 测试 ${c.mock}</div></div>
        <div class="panel kpi"><div class="k">已回填</div><div class="v">${c.metrics}</div><div class="s">按天记录，看板出结论</div></div>
      </div>
      <table>
        <thead><tr><th style="width:42px">#</th><th>这一步做什么</th><th style="width:120px">现在有多少</th><th style="width:110px"></th></tr></thead>
        <tbody>
          ${WF_STEPS.map(([n, name, go, desc]) => `<tr>
            <td class="mono">${n}</td>
            <td><b>${esc(name)}</b><div class="muted" style="font-size:12px">${esc(desc)}</div></td>
            <td class="num">${stat[go] ?? 0}</td>
            <td><button class="btn ghost tiny" data-go="${go}">去做</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p class="muted" style="margin-top:12px;font-size:12px">情报快照：${esc(wf.radar_at || '还没抓过')} · kimi 已审 ${c.audit_items + c.audit_kw} 条</p>
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
    </div>`;
}

/* ================= 账号 ================= */
const PLATFORM_AUTH = {
  facebook_page: { url: 'https://developers.facebook.com/apps/', need: 'App ID / Secret + 主页访问令牌（Pages API）', note: '建 App → 加 Pages 权限 → 用 Graph API Explorer 取页面令牌（长期令牌建议走系统用户）' },
  instagram: { url: 'https://developers.facebook.com/apps/', need: 'IG 专业账号 + 关联 FB 主页 + 访问令牌', note: 'IG 必须挂在 FB 主页下；用 Content Publishing API 发图' },
  tiktok: { url: 'https://developers.tiktok.com/apps', need: 'Client Key / Secret + 授权（Content Posting API）', note: '建 App → 申请 content.post 权限 → 走 OAuth 拿 access_token' },
  pinterest: { url: 'https://developers.pinterest.com/apps/', need: 'App ID / Secret + 授权（Pins API）', note: '建 App → 申请 pins:write → OAuth 拿 refresh token' },
  x: { url: 'https://developer.x.com/en/portal/dashboard', need: 'API Key / Secret + Access Token', note: '免费档只能发文本；发图要 Basic 以上' },
  linkedin: { url: 'https://www.linkedin.com/developers/apps', need: 'Client ID / Secret + 组织页授权', note: '要公司主页管理员身份才能发到 Page' },
  youtube: { url: 'https://console.cloud.google.com/apis/credentials', need: 'OAuth 客户端 + YouTube Data API 权限', note: '上传视频需要未验证配额 1600 点/天' },
  reddit: { url: 'https://www.reddit.com/prefs/apps', need: 'client_id / secret + refresh token', note: '脚本型 App，注意 subreddit 规则' },
  threads: { url: 'https://developers.facebook.com/apps/', need: 'Threads API 权限', note: '和 IG 同一个 Meta App，加 Threads 产品' },
  mastodon: { url: 'https://mastodon.social/settings/applications', need: '实例应用 + access token（write 权限）', note: '应用名填 Packrivo；网站填 https://www.packrivo.com；重定向 URI 保留 urn:ietf:wg:oauth:2.0:oob；权限勾 write（read 可一并勾）。提交后复制「你的访问令牌」' },
  bluesky: { url: 'https://bsky.app/settings/app-passwords', need: 'App Password', note: '不是登录密码；生成一次就复制' },
  telegram: { url: 'https://t.me/BotFather', need: 'Bot Token + 频道 chat_id', note: '建 bot → 拉进频道设为管理员 → 频道 @username 或 -100xxx' },
  pinterest_ads: { url: 'https://ads.pinterest.com/', need: '广告账号（可选）', note: '' },
};

function accountUrl(a) {
  if (a.profile_url) return a.profile_url;
  const h = String(a.handle || '').replace(/^@/, '');
  const map = {
    bluesky: () => (h ? 'https://bsky.app/profile/' + h : 'https://bsky.app'),
    mastodon: () => (h ? 'https://' + h.split('@').pop() + '/@' + h.split('@')[0] : 'https://mastodon.social'),
    instagram: () => (h ? 'https://instagram.com/' + h : 'https://instagram.com'),
    tiktok: () => (h ? 'https://www.tiktok.com/@' + h : 'https://www.tiktok.com'),
    facebook_page: () => (h ? 'https://facebook.com/' + h : 'https://facebook.com'),
    pinterest: () => (h ? 'https://pinterest.com/' + h : 'https://pinterest.com'),
    x: () => (h ? 'https://x.com/' + h : 'https://x.com'),
    youtube: () => (h ? 'https://youtube.com/@' + h : 'https://youtube.com'),
    telegram: () => 'https://web.telegram.org',
  };
  return (map[a.platform] || (() => '#'))();
}

async function viewAccounts() {
  const [{ accounts }, plat] = await Promise.all([api('/api/accounts'), api('/api/platforms')]);
  ST.platforms = plat.platforms;
  const preset = ST.presetPlatform || (ST.platforms[0] && ST.platforms[0].code);
  ST.presetPlatform = null;
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>新增账号</h2><span class="hint">一个平台一个号起步；同平台多号请配独立代理</span></div>
      <div class="row">
        <div class="field"><label>平台</label><select id="a-plat">${ST.platforms.map((p) => `<option value="${p.code}" ${p.code === preset ? 'selected' : ''}>${esc(p.label)}（${esc(KIND[p.kind] || '')}）</option>`).join('')}</select></div>
        <div class="field"><label>handle</label><input id="a-handle" placeholder="@packrivo" /></div>
        <div class="field" style="flex:1"><label>主页链接</label><input id="a-url" placeholder="https://..." /></div>
        <div class="field" style="flex:1"><label>出口代理（可空）</label><input id="a-proxy" placeholder="http://user:pass@ip:port" /></div>
        <div class="field"><label>integration id（Postiz 必填）</label><input id="a-int" placeholder="Postiz 集成 id" /></div>
        <div class="field"><label>integration 标识（可空）</label><input id="a-intname" placeholder="如 mypage" /></div>
        <button class="btn primary" id="a-add">添加</button>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>账号 · ${accounts.length}</h2></div>
      ${accounts.length ? `<table><thead><tr><th>#</th><th>平台</th><th>handle</th><th>状态</th><th>会话</th><th>代理</th><th>integration</th><th>凭据</th><th></th></tr></thead><tbody>
        ${accounts.map((a) => `<tr><td class="mono">${a.id}</td><td>${esc(pname(a.platform))}</td><td>${esc(a.handle)}</td>
          <td>${a.status_view === '已授权' ? '<span class="tag ok">已授权</span>' : '<span class="tag warn">未授权</span>'}</td><td>${esc(a.session_state)}</td><td class="mono">${esc(a.proxy || '—')}</td><td class="mono">${a.integration_id ? `<span class="tag ok">已绑定</span> <span class="mono">${esc(a.integration_id)}</span>` : '<span class="tag bad">未绑定</span>'} <button class="btn ghost tiny" data-bind="${a.id}">${a.integration_id ? '改' : '绑定'}</button></td><td>${a.cred_count}</td>
          <td><a class="btn ghost tiny" href="${esc(accountUrl(a))}" target="_blank" rel="noreferrer">打开主页</a>${PLATFORM_AUTH[a.platform] ? `<a class="btn ghost tiny" href="${PLATFORM_AUTH[a.platform].url}" target="_blank" rel="noreferrer">去绑定</a>` : ""}<button class="btn ghost tiny" data-cred="${a.id}" data-plat="${a.platform}">填凭据</button><button class="btn ghost tiny" data-probe="${a.id}">探测</button><button class="btn danger tiny" data-dela="${a.id}">删</button></td></tr>
        <tr class="cred-form" id="cred-${a.id}" style="display:none"><td colspan="9" style="background:var(--surface-2)">
          <div class="row" style="align-items:flex-end;gap:10px;padding:6px 0">
            ${(a.platform === 'bluesky'
              ? [["handle","handle（如 packrivo.bsky.social）","packrivo.bsky.social"],["app_password","App Password（xxxx-xxxx-xxxx-xxxx）","xxxx-xxxx-xxxx-xxxx"]]
              : a.platform === 'mastodon'
                ? [["instance","实例域名（如 mastodon.social）","mastodon.social"],["access_token","access token","粘贴 token"]]
                : [["field","字段名",""],["value","值",""]]
            ).map(([f, label, ph]) => `<div class="field" style="flex:1"><label>${label}</label><input id="cf-${a.id}-${f}" placeholder="${ph}" value="${f === 'handle' && a.handle ? String(a.handle).replace(/^@/, '') : ''}" /></div>`).join('')}
            <button class="btn primary tiny" data-cred-save="${a.id}" data-plat="${a.platform}">保存并验证</button>
          </div>
          <div class="muted" id="cred-msg-${a.id}" style="font-size:12px">${a.platform === 'bluesky' ? 'App Password 在 Bluesky 设置里生成，不是你的登录密码' : a.platform === 'mastodon' ? 'token 在实例的 Preferences → Development 里生成，勾 write 权限' : ''}</div>
        </td></tr>
        <tr class="bind-form" id="bind-${a.id}" style="display:none"><td colspan="9" style="background:var(--surface-2)">
          <div class="row" style="align-items:flex-end;gap:10px;padding:6px 0">
            <div class="field" style="flex:1"><label>Postiz 集成 id（integration_id，Postiz 必填）</label><input id="bf-${a.id}-iid" placeholder="如 int-abc123" value="${esc(a.integration_id || '')}" /></div>
            <div class="field" style="flex:1"><label>集成标识（identifier，可空）</label><input id="bf-${a.id}-ident" placeholder="如 mypage" value="${esc(a.integration_identifier || '')}" /></div>
            <button class="btn primary tiny" data-bind-save="${a.id}">保存绑定</button>
            <button class="btn ghost tiny" data-bind-cancel="${a.id}">取消</button>
          </div>
          <div class="muted" id="bind-msg-${a.id}" style="font-size:12px">留空 integration_id 并保存 = 解绑（显式清空，不再自动兜底）</div>
        </td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有账号，发布必须挂账号</div>'}
    </div>`;
  $('#a-add').onclick = async () => {
    try {
      await api('/api/accounts', 'POST', {
        platform: $('#a-plat').value,
        handle: $('#a-handle').value,
        profile_url: $('#a-url').value,
        proxy: $('#a-proxy').value,
        integration_id: $('#a-int').value,
        integration_identifier: $('#a-intname').value,
      });
      toast('已添加'); viewAccounts();
    } catch (e) { toast(e.message, true); }
  };
  // PUB-04：绑定关系必须是显式填的，不再靠「取第一个账号」兜底；内联表单 + 状态处理
  const bindRow = (id) => $('#bind-' + id);
  const toggleRow = (row, on) => { if (row) row.style.display = on ? 'table-row' : 'none'; };
  $$('[data-bind]').forEach((b) => (b.onclick = () => {
    const row = bindRow(b.dataset.bind);
    if (!row) return;
    // 打开绑定时先收起该行的凭据表单，避免两个内联表单同屏混淆
    const cred = $('#cred-' + b.dataset.bind);
    if (cred) cred.style.display = 'none';
    toggleRow(row, row.style.display === 'none' || !row.style.display);
  }));
  $$('[data-bind-cancel]').forEach((b) => (b.onclick = () => toggleRow(bindRow(b.dataset.bindCancel), false)));
  $$('[data-bind-save]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.bindSave;
    const msg = $('#bind-msg-' + id);
    const iidEl = $('#bf-' + id + '-iid');
    const identEl = $('#bf-' + id + '-ident');
    const iid = iidEl ? iidEl.value : '';
    const ident = identEl ? identEl.value : '';
    b.disabled = true; b.textContent = '保存中…';
    if (msg) msg.innerHTML = '<span class="tag info">绑定中…</span>';
    try {
      await api('/api/accounts/' + id, 'PATCH', { integration_id: iid.trim(), integration_identifier: ident.trim() });
      toast(iid.trim() ? '已绑定' : '已解绑');
      viewAccounts();
    } catch (e) {
      if (msg) msg.innerHTML = '<span class="tag bad">' + esc(e.message) + '</span>';
      toast(e.message, true);
      b.disabled = false; b.textContent = '保存绑定';
    }
  }));
  $$('[data-cred]').forEach((b) => (b.onclick = () => {
    const row = $('#cred-' + b.dataset.cred);
    if (row) row.style.display = row.style.display === 'none' || !row.style.display ? 'table-row' : 'none';
  }));
  $$('[data-cred-save]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.credSave;
    const inputs = Array.from(document.querySelectorAll('[id^="cf-' + id + '-"]'));
    const msg = $('#cred-msg-' + id);
    b.disabled = true; b.textContent = '保存中…';
    try {
      for (const inp of inputs) {
        const field = inp.id.replace('cf-' + id + '-', '');
        if (!inp.value.trim()) continue;
        await api('/api/accounts/' + id + '/credential', 'POST', { field, value: inp.value.trim() });
      }
      const r = await api('/api/accounts/' + id + '/probe', 'POST');
      if (msg) msg.innerHTML = r.ok ? '<span class="tag ok">验证通过</span> ' + esc(r.reason) : '<span class="tag bad">没通过</span> ' + esc(r.reason);
      toast(r.ok ? '凭据已验证' : r.reason, !r.ok);
      if (r.ok) setTimeout(viewAccounts, 900);
    } catch (e) { if (msg) msg.innerHTML = '<span class="tag bad">' + esc(e.message) + '</span>'; toast(e.message, true); }
    b.disabled = false; b.textContent = '保存并验证';
  }));
  $$('[data-probe]').forEach((b) => (b.onclick = async () => {
    try { const r = await api(`/api/accounts/${b.dataset.probe}/probe`, 'POST'); toast(r.reason, true); viewAccounts(); }
    catch (e) { toast(e.message, true); }
  }));
  $$('[data-dela]').forEach((b) => (b.onclick = async () => { await api(`/api/accounts/${b.dataset.dela}`, 'DELETE'); toast('已删除'); viewAccounts(); }));

  /* 各平台授权入口：点开平台官方页面拿凭据 */
  $('#view').insertAdjacentHTML('beforeend', `
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>各平台绑定入口</h2><span class="hint">先点「打开授权页」到平台官方页面拿凭据，回来在这条账号上点「填凭据」粘贴</span></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px">
        ${['bluesky','telegram','mastodon','facebook_page','instagram','threads','tiktok','pinterest','x','linkedin','youtube','reddit']
          .filter((k) => PLATFORM_AUTH[k])
          .map((k) => {
            const v = PLATFORM_AUTH[k];
            return `<div class="panel" style="background:var(--surface-2);padding:12px">
              <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
                <strong>${esc(pname(k) || k)}</strong>
                <a class="btn tiny" href="${v.url}" target="_blank" rel="noreferrer">打开授权页</a>
              </div>
              <div class="muted" style="font-size:12.5px;margin-top:6px">需要：${esc(v.need)}</div>
              ${v.note ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(v.note)}</div>` : ''}
            </div>`;
          }).join('')}
      </div>
      <p class="muted" style="margin-top:10px;font-size:12px">FB / IG / Threads / TikTok / Pinterest 都要 App 审核；审核期间先用 Bluesky 和 Telegram 跑流程。</p>
    </div>`);
}

/* ================= 模型 ================= */
async function viewModels() {
  const [{ endpoints, builtin }, vid] = await Promise.all([api('/api/models'), api('/api/video/status')]);
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>内置网关</h2><span class="hint">OpenAI 兼容，任务映射在设置里改</span></div>
      <p>${builtin.ok ? `<span class="tag ok">在线</span> <span class="muted">${builtin.models.length} 个模型</span>` : `<span class="tag bad">离线</span> ${esc(builtin.error || '')}`}</p>
      ${(() => {
        const norm = (m) => String(m).replace(/\s*·.*$/, '').replace(/^zen\//, '').replace(/^kilo\/.*$/, '').trim().toLowerCase();
        const seen = new Set();
        const uniq = (builtin.models || []).filter((m) => { const k = norm(m); if (!k || seen.has(k)) return false; seen.add(k); return true; });
        return `<div class="pill-list" style="margin-top:8px">${uniq.slice(0, 8).map((m) => `<span class="tag mute">${esc(m)}</span>`).join("")}</div>`;
      })()}
      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer;font-size:12px">展开全部 ${(builtin.models || []).length} 个模型</summary>
        <div class="pill-list" style="margin-top:8px">${(builtin.models || []).map((m) => `<span class="tag mute">${esc(m)}</span>`).join('')}</div></details>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>视频接口</h2><span class="hint">加了就能被 /api/video/generate 调用</span></div>
      <p>${vid.ready ? '<span class="tag ok">已配置</span>' : '<span class="tag warn">未配置</span>'} ${esc(vid.note)}</p>
      <p class="muted mono">POST /api/video/generate {"prompt":"…","content_id":12} · 路径 ${esc(vid.api_path)}</p>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>自定义接口</h2><span class="hint">优先级升序，主接口失败自动降级</span></div>
      <div class="row">
        <div class="field"><label>名称</label><input id="m-name" placeholder="中转站 GPT" /></div>
        <div class="field"><label>用途</label><select id="m-kind"><option value="text">文字</option><option value="image">图片</option><option value="video">视频</option></select></div>
        <div class="field" style="flex:1"><label>Base URL</label><input id="m-base" placeholder="https://api.xxx.com/v1" /></div>
        <div class="field"><label>模型名</label><input id="m-model" /></div>
        <div class="field"><label>Key</label><input id="m-key" type="password" /></div>
        <div class="field" style="max-width:92px"><label>优先级</label><input id="m-pri" value="100" /></div>
        <button class="btn primary" id="m-add">添加</button>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>接口列表 · ${endpoints.length}</h2></div>
      ${endpoints.length ? `<table><thead><tr><th>#</th><th>名称</th><th>用途</th><th>Base</th><th>模型</th><th>Key</th><th>优先级</th><th>最近成功</th><th></th></tr></thead><tbody>
        ${endpoints.map((e) => `<tr><td class="mono">${e.id}</td><td>${esc(e.name)}</td><td>${esc(e.kind)}</td>
          <td class="mono">${esc(e.base_url)}</td><td class="mono">${esc(e.model)}</td><td class="mono">${esc(e.key_hint)}</td>
          <td class="num">${e.priority}</td><td class="mono">${esc(e.last_ok_at || '—')}</td>
          <td style="white-space:nowrap"><button class="btn ghost tiny" data-test="${e.id}">测试</button><button class="btn danger tiny" data-delm="${e.id}">删</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">还没有自定义接口，内置网关够用</div>'}
    </div>`;
  $('#m-add').onclick = async () => {
    try {
      await api('/api/models', 'POST', {
        name: $('#m-name').value, kind: $('#m-kind').value, base_url: $('#m-base').value,
        model: $('#m-model').value, api_key: $('#m-key').value, priority: Number($('#m-pri').value || 100),
      });
      toast('已添加'); viewModels();
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-test]').forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = '测试中…';
    try { const r = await api(`/api/models/${b.dataset.test}/test`, 'POST'); toast(r.ok ? `连通 ${r.models.length} 个模型` : `失败 ${r.error}`, !r.ok); }
    catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = '测试';
  }));
  $$('[data-delm]').forEach((b) => (b.onclick = async () => { await api(`/api/models/${b.dataset.delm}`, 'DELETE'); toast('已删除'); viewModels(); }));
}

/* ================= 台账 ================= */
async function viewLedger() {
  const { ledger } = await api('/api/ledger');
  const cls = (s) => (s === '已跑通' ? 'ok' : s === '部分跑通' ? 'warn' : s === '待跑通' ? 'info' : 'mute');
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>模块状态台账</h2><span class="hint">交付口径：已跑通可直接用，其余写清缺什么</span></div>
      <table><thead><tr><th>模块</th><th>阶段</th><th>状态</th><th>说明</th></tr></thead><tbody>
        ${ledger.map((x) => `<tr><td><strong>${esc(x.module)}</strong></td><td>${esc(x.stage)}</td>
          <td><span class="tag ${cls(x.state)}">${esc(x.state)}</span></td><td class="muted">${esc(x.detail)}</td></tr>`).join('')}
      </tbody></table>
    </div>`;
}

/* ================= 设置 ================= */
async function viewSettings() {
  const { settings, secrets = {} } = await api('/api/settings');
  let pz = { configured: false, key_saved: false, key_hint: '', base: '' };
  try { pz = await api('/api/channels/postiz'); } catch {}
  // 密钥类字段后端只回 "" + {saved, hint}，所以密码框一律不回显值，只给"已保存 xxx"提示
  const savedHint = (k, fallback = '') => (secrets[k]?.saved ? '已保存 ' + (secrets[k].hint || '') + '，留空即不改' : fallback);
  const f = (k, label, type = 'text', extra = '', ph = '') => `<div class="field"><label>${label}</label><input id="s-${k}" value="${esc(settings[k])}" placeholder="${esc(ph)}" ${extra} /></div>`;
  const fp = (k, label, ph = '') => `<div class="field"><label>${label}</label><input id="s-${k}" type="password" autocomplete="off" placeholder="${esc(savedHint(k, ph))}" /></div>`;
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>发布与审核</h2></div>
      <div class="grid g3">
        <div class="field"><label>发布模式</label><select id="s-publish_mode">
          ${[['auto', 'auto · AI 通过即发（敏感项强制人工）'], ['semi', 'semi · AI 预审 + 人工通过'], ['manual', 'manual · 只人工']].map(([v, l]) => `<option value="${v}" ${settings.publish_mode === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>默认通道</label><select id="s-publish_channel_default">
          ${['mock', 'webhook', 'postiz'].map((v) => `<option ${settings.publish_channel_default === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select></div>
        <div class="field"><label>公网地址（平台回调要 HTTPS）</label><input id="s-public_base_url" value="${esc(settings.public_base_url)}" /></div>
        <div class="field"><label>敏感项人工闸门</label><button class="btn " id="s-sens-toggle">状态加载中</button></div>
        ${f('review_sensitive_extra', '额外敏感词（逗号分隔）')}
        ${f('weekly_quota', '每平台每周条数')}
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>品牌与市场</h2></div>
      <div class="grid g3">
        ${f('brand_tone', '品牌调性')}
        ${f('primary_lang', '主语言')}
        ${f('market', '目标市场')}
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>外部对接</h2><span class="hint">Postiz 走公开 API v1：Base URL 自动补 /api/public/v1，鉴权用 Authorization: &lt;api key&gt;</span></div>
      <div class="grid g3">
        ${f('webhook_url', 'webhook_url')}
        <div class="field"><label>Postiz Base URL（付费云版就填 https://api.postiz.com，不用自己申请各平台开发者应用）</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="s-postiz_base" value="${esc(settings.postiz_base)}" placeholder="https://api.postiz.com" style="flex:1" />
            <button class="btn ghost" id="s-postiz-cloud" type="button" title="自动补成 https://api.postiz.com/public/v1">云版</button>
          </div></div>
        <div class="field"><label>Postiz API Key（AES-GCM 加密存，只回显后 4 位）</label>
          <input id="s-postiz_key" type="password" autocomplete="off" placeholder="${pz.key_saved ? '已保存 ' + esc(pz.key_hint) + '，留空即不改' : '未保存，去 Postiz 后台 Settings → API Keys 生成'}" /></div>
        <div class="field"><label>提交方式 postiz_type</label><select id="s-postiz_type">
          ${[['now', 'now · 工作台到点后立即发'], ['schedule', 'schedule · 把 run_at 交给 Postiz 排期'], ['draft', 'draft · 只建草稿，人工在 Postiz 里点发']]
            .map(([v, l]) => `<option value="${v}" ${(settings.postiz_type || 'now') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>通道连通性</label><button class="btn ghost" id="s-postiz-verify">保存并验证 Postiz</button></div>
        ${f('video_api_path', '视频接口路径')}
        ${fp('apify_token', 'Apify Token（TikTok/IG 找爆款）', '未保存，去 Apify Console → Settings → Integrations 拿')}
        <div class="field"><label>图像 API Base（主）</label><input id="s-image_api_base" placeholder="https://tokenstation.top/v1" /></div>
        ${fp('image_api_key', '图像 API Key（主）', '未保存')}
        <div class="field"><label>图像模型（主）</label><input id="s-image_api_model" placeholder="gpt-image-2" /></div>
        <div class="field"><label>图像 API Base（备）</label><input id="s-image_api_backup_base" placeholder="https://tokenstation.top/v1" /></div>
        ${fp('image_api_backup_key', '图像 API Key（备）', '未保存')}
        <div class="field"><label>图像模型（备）</label><input id="s-image_api_backup_model" placeholder="gpt-image-2.5" /></div>
        ${fp('image_api_fallback_key', '图像 API Key（兜底 · apimart）', '未保存')}
        ${fp('telegram_bot_token', 'Telegram Bot Token', '未保存')}
        <div class="field"><label>Telegram chat_id</label><input id="s-telegram_chat_id" placeholder="@channel 或 -100xxx" /></div>
        ${f('apify_actor', 'Apify Actor ID')}
      </div>
      <div id="s-postiz-out" class="muted" style="margin-top:10px;font-size:12px">${pz.configured
        ? '当前：' + esc(pz.base) + ' · Key ' + esc(pz.key_hint)
          + (pz.cloud ? ' · <span class="tag ok">官方云版</span> 建帖端点 90 次/小时' : ' · 自建实例（额度看 API_LIMIT）')
          + (pz.cooldown_ms > 0 ? ' · <span class="tag warn">限流冷却中，约 ' + Math.ceil(pz.cooldown_ms / 60000) + ' 分钟后恢复</span>' : '')
          + (pz.connectivity === 'key_invalid' ? ' · <span class="tag bad">Key 无效（对方服务通、鉴权被拒）</span>' : '')
          + (pz.connectivity === 'unreachable' ? ' · <span class="tag bad">连不上（网络/地址不通）</span>' : '')
        : '当前未配置 Postiz'}</div>
      <details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:12px">高级：通道映射与平台 settings（JSON）</summary>
        <div class="grid g3" style="margin-top:8px">
          ${f('postiz_integration_map', 'postiz_integration_map（平台→integration id，仅作展示提示；真正生效的是账号页里绑的 integration_id）')}
          ${f('postiz_settings', 'postiz_settings（按 __type 覆盖，如 {"pinterest":{"board":"xxx"}}）')}
        </div></details>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>模型映射</h2><span class="hint">每个任务用一个下拉框选模型</span></div>
      <div class="grid g3" id="s-task-models"></div>
      <details style="margin-top:12px"><summary class="muted" style="cursor:pointer;font-size:12px">高级：直接编辑 JSON</summary>
        <div class="field" style="margin-top:8px"><textarea id="s-llm_task_models">${esc(settings.llm_task_models)}</textarea></div></details>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="s-save">保存全部</button></div>`;

  ST.sensOn = String(settings.review_sensitive_enabled) === '1';
  const sensBtn = $('#s-sens-toggle');
  const paintSens = () => { if (!sensBtn) return; sensBtn.textContent = ST.sensOn ? '已开启（命中就转人工）' : '已关闭'; sensBtn.className = 'btn ' + (ST.sensOn ? 'primary' : 'ghost'); };
  paintSens();
  if (sensBtn) sensBtn.onclick = () => { ST.sensOn = !ST.sensOn; paintSens(); };
  (async () => {
    try {
      const { builtin } = await api('/api/models');
      const norm = (m) => String(m).replace(/\s*·.*$/, '').replace(/^zen\//, '').replace(/^kilo\/.*$/, '').trim().toLowerCase();
      const seen = new Set();
      const models = (builtin.models || [])
        .filter((m) => !String(m).startsWith('route/'))
        .filter((m) => {
          const k = norm(m);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => (String(a).includes('·') ? 1 : 0) - (String(b).includes('·') ? 1 : 0));
      let map = {};
      try { map = JSON.parse(settings.llm_task_models || '{}'); } catch {}
      const tasks = [['brief', '内容简报(监工)'], ['deconstruct', '爆款拆解'], ['rewrite', '文案改写'], ['review', '审核预审'], ['analyze', 'SEO/GEO 分析'], ['audit', 'kimi 质检'], ['report', '报告撰写']];
      const box = $('#s-task-models');
      if (box) box.innerHTML = tasks.map(([k, label]) => '<div class="field"><label>' + label + '</label><select data-task="' + k + '">' + models.map((m) => '<option value="' + esc(m) + '" ' + (map[k] === m ? 'selected' : '') + '>' + esc(String(m).replace(/\s*·.*$/, '')) + '</option>').join('') + '</select></div>').join('');
    } catch {}
  })();
  const pzBtn = $('#s-postiz-verify');
  if (pzBtn) pzBtn.onclick = async () => {
    const out = $('#s-postiz-out');
    const baseEl = $('#s-postiz_base');
    const keyEl = $('#s-postiz_key');
    pzBtn.disabled = true;
    out.textContent = '验证中…';
    try {
      if (baseEl) await api('/api/settings', 'PUT', { postiz_base: baseEl.value.trim() });
      if (keyEl && keyEl.value.trim()) {
        const r = await api('/api/channels/postiz/key', 'POST', { key: keyEl.value.trim() });
        keyEl.value = '';
        keyEl.placeholder = r.saved ? '已保存 ' + r.hint : '未保存';
      }
      const r = await api('/api/channels/postiz/verify', 'POST', {});
      if (!r.ok) {
        out.innerHTML = `<span class="tag bad">${esc(r.error_class || 'error')}</span> ${esc(r.error || '')}${r.error_class === 'rate_limited' ? '<div class="muted" style="margin-top:6px">云版建帖端点 90 次/小时，撞到 429 后工作台会自动冷却，冷却期内不会重复请求上游。</div>' : ''}${r.detail ? `<div class="muted" style="margin-top:6px">${esc(String(r.detail).slice(0, 400))}</div>` : ''}`;
        toast('Postiz 未连通：' + (r.error || ''), true);
      } else {
        const rows = (r.integrations || []).map((i) => `<li>${esc(i.identifier)} · ${esc(i.name)}${i.profile ? ' @' + esc(i.profile) : ''}${i.disabled ? '（已停用）' : ''} <span class="muted">${esc(i.id)}</span></li>`).join('');
        const matched = Object.entries(r.matched || {}).map(([p, v]) => `<span class="tag ok">${esc(p)} → ${esc(v.identifier)}</span>`).join(' ') || '<span class="muted">没有可匹配的工作台平台</span>';
        out.innerHTML = `<span class="tag ok">已连通</span> ${esc(r.base)} · Key ${esc(r.key_hint)} · 通道 ${r.count} 个${r.cloud ? ' · <span class="tag ok">官方云版</span>（建帖 90 次/小时）' : ''}
          <div style="margin-top:8px"><strong>能对接的：</strong>${matched}</div>
          ${r.unmatched?.length ? `<div class="muted" style="margin-top:4px">还没接通道：${esc(r.unmatched.join('、'))}</div>` : ''}
          ${rows ? `<ul style="margin:8px 0 0 18px">${rows}</ul>` : ''}`;
        toast('Postiz 已连通，通道 ' + r.count + ' 个');
      }
    } catch (e) {
      out.textContent = '验证失败：' + e.message;
      toast(e.message, true);
    } finally { pzBtn.disabled = false; }
  };
  const cloudBtn = $('#s-postiz-cloud');
  if (cloudBtn) cloudBtn.onclick = () => {
    const el = $('#s-postiz_base');
    if (el) el.value = 'https://api.postiz.com';
    const out = $('#s-postiz-out');
    if (out) out.textContent = '已填入云版地址（保存时后端自动补 /public/v1）。Key 去 Postiz 后台 Settings → API Keys 复制，然后点「保存并验证 Postiz」。';
  };
  $('#s-save').onclick = async () => {
    const keys = ['publish_mode', 'publish_channel_default', 'public_base_url', 'review_sensitive_extra', 'weekly_quota', 'brand_tone', 'primary_lang', 'market', 'webhook_url', 'postiz_base', 'postiz_type', 'postiz_integration_map', 'postiz_settings', 'video_api_path', 'apify_token', 'apify_actor', 'image_api_base', 'image_api_key', 'image_api_model', 'image_api_backup_base', 'image_api_backup_key', 'image_api_backup_model', 'image_api_fallback_base', 'image_api_fallback_key', 'image_api_fallback_model', 'telegram_bot_token', 'telegram_chat_id'];
    const body = {};
    for (const k of keys) {
      const el = $('#s-' + k);
      if (!el) continue;
      // 密码类输入框渲染时故意不带 value，留空表示"不改动"，不能把空串 PUT 上去覆盖已存密钥
      if (el.type === 'password' && el.value === '') continue;
      body[k] = el.value;
    }
    body.review_sensitive_enabled = ST.sensOn ? '1' : '0';
    const map = {};
    $$('#s-task-models select').forEach((sel) => { if (sel.dataset.task) map[sel.dataset.task] = sel.value; });
    body.llm_task_models = JSON.stringify(map);
    if (body.publish_mode === 'auto' && !confirm('切到 auto 后，AI 审核通过的内容会直接发到真实账号（敏感项仍会拦）。确定吗？')) return;
    try {
      await api('/api/settings', 'PUT', body);
      const kEl = $('#s-postiz_key');
      if (kEl && kEl.value.trim()) {
        const r = await api('/api/channels/postiz/key', 'POST', { key: kEl.value.trim() });
        kEl.value = '';
        kEl.placeholder = r.saved ? '已保存 ' + r.hint : '未保存';
      }
      toast('已保存');
    } catch (e) { toast(e.message, true); }
  };
}

/* ================= 知识库 ================= */
async function viewKnowledge() {
  const { items, kinds } = await api('/api/kb');
  const groups = Object.keys(kinds);
  $('#view').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>品牌知识库</h2><span class="hint">AI 生成与审核都会读这里；越写越懂你</span></div>
      <div class="row">
        <div class="field"><label>类型</label><select id="k-kind">${groups.map((g) => `<option value="${g}">${esc(kinds[g])}</option>`).join('')}</select></div>
        <div class="field" style="flex:1"><label>标题</label><input id="k-title" placeholder="品牌一句话定位 / 目标客户 / 禁用词" /></div>
        <div class="field" style="max-width:110px"><label>权重</label><input id="k-weight" type="number" value="50" min="0" max="100" /></div>
      </div>
      <div class="field" style="margin-top:10px"><label>内容</label><textarea id="k-content" placeholder="写成一句句事实，AI 会照这个说话"></textarea></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="k-add">加入知识库</button></div>
    </div>
    ${groups.map((g) => {
      const list = items.filter((x) => x.kind === g);
      if (!list.length) return '';
      return `<div class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>${esc(kinds[g])} · ${list.length}</h2></div>
        ${list.map((x) => `<div style="padding:10px 0;border-bottom:1px solid var(--line-soft)">
          <div class="row" style="justify-content:space-between;align-items:center">
            <strong>${esc(x.title)}</strong>
            <div class="row tight">
              <span class="tag ${x.enabled ? 'ok' : 'mute'}">${x.enabled ? '启用' : '停用'}</span>
              <button class="btn ghost tiny" data-kb-toggle="${x.id}" data-on="${x.enabled}">${x.enabled ? '停用' : '启用'}</button>
              <button class="btn danger tiny" data-kb-del="${x.id}">删</button>
            </div>
          </div>
          <div class="muted" style="margin-top:4px;white-space:pre-wrap">${esc(x.content)}</div>
        </div>`).join('')}
      </div>`;
    }).join('')}
    ${items.length ? '' : '<div class="panel" style="margin-top:14px"><div class="empty">知识库是空的。先加三条：品牌定位、目标客户、禁用词</div></div>'}`;

  $('#k-add').onclick = async () => {
    try {
      await api('/api/kb', 'POST', {
        kind: $('#k-kind').value, title: $('#k-title').value, content: $('#k-content').value,
        weight: Number($('#k-weight').value || 50),
      });
      toast('已加入'); viewKnowledge();
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-kb-toggle]').forEach((b) => (b.onclick = async () => {
    await api('/api/kb/' + b.dataset.kbToggle, 'PATCH', { enabled: b.dataset.on === '1' ? 0 : 1 });
    viewKnowledge();
  }));
  $$('[data-kb-del]').forEach((b) => (b.onclick = async () => {
    await api('/api/kb/' + b.dataset.kbDel, 'DELETE'); toast('已删除'); viewKnowledge();
  }));
}

/* 分析结果渲染 */
function renderSeoGeo(a) {
  const bar = (label, score, cls) => `<div style="margin-bottom:10px">
    <div class="row" style="justify-content:space-between"><span>${label}</span><strong class="${cls}">${score}</strong></div>
    <div class="bar"><i style="width:${Math.max(2, Math.min(100, score))}%"></i></div></div>`;
  return `<div class="grid g2" style="margin-top:10px">
    <div>
      ${bar('SEO（搜索可发现性）', a.seo?.score ?? 0, '')}
      ${(a.seo?.issues || []).map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}
      ${(a.seo?.fixes || []).length ? `<div style="margin-top:6px"><strong style="font-size:12px">改法</strong>${(a.seo.fixes || []).map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}
    </div>
    <div>
      ${bar('GEO（AI 引擎可引用性）', a.geo?.score ?? 0, '')}
      ${(a.geo?.issues || []).map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}
      ${(a.geo?.fixes || []).length ? `<div style="margin-top:6px"><strong style="font-size:12px">改法</strong>${(a.geo.fixes || []).map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}
    </div>
  </div>
  ${(a.keywords || []).length ? `<div class="pill-list" style="margin-top:8px">${a.keywords.map((k) => `<span class="tag info">${esc(k)}</span>`).join('')}</div>` : ''}
  ${a.optimized_title ? `<div style="margin-top:8px"><strong style="font-size:12px">建议标题</strong><div class="pre" style="margin-top:4px">${esc(a.optimized_title)}</div></div>` : ''}
  ${(a.optimized_points || []).length ? `<div style="margin-top:8px"><strong style="font-size:12px">可直接照改</strong>${a.optimized_points.map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}`;
}

function renderHotspotAnalysis(a) {
  return `<div style="margin-top:10px">
    ${(a.why || []).length ? `<div><strong style="font-size:12px">为什么它能火</strong>${a.why.map((w) => `<div class="muted" style="font-size:11.5px">· ${esc(w.point)}${w.evidence ? '（' + esc(w.evidence) + '）' : ''}</div>`).join('')}</div>` : ''}
    ${a.audience ? `<div style="margin-top:6px"><strong style="font-size:12px">打的是谁</strong><div class="muted" style="font-size:11.5px">${esc(a.audience)}</div></div>` : ''}
    ${(a.reusable || []).length ? `<div style="margin-top:6px"><strong style="font-size:12px">可复用</strong>${a.reusable.map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}
    ${(a.risks || []).length ? `<div style="margin-top:6px"><strong style="font-size:12px">照搬的坑</strong>${a.risks.map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}
    ${(a.geo?.answerable_questions || []).length ? `<div style="margin-top:6px"><strong style="font-size:12px">买家会问 AI 的问题</strong>${a.geo.answerable_questions.map((x) => `<div class="muted" style="font-size:11.5px">· ${esc(x)}</div>`).join('')}</div>` : ''}
  </div>`;
}
/* ================= 情报雷达 / 首次引导 ================= */
async function saveHotspots(items) {
  if (!items.length) return;
  const r = await api('/api/hotspots/bulk', 'POST', { items });
  toast(`已入库 ${r.count} 条`);
}

function setupForm(profile) {
  const presets = ['custom packaging', 'mailer box', 'corrugated shipping box', 'rigid gift box', 'eco packaging'];
  return `
    <div class="panel">
      <div class="panel-head"><h2>先告诉我你做什么</h2><span class="hint">填完点「保存并抓取」，工作台会立刻去搜热门视频、文章、同行和关键词</span></div>
      <div class="grid g2">
        <div class="field"><label>类目（必填）</label>
          <input id="w-category" list="cat-list" value="${esc(profile.category || 'custom packaging')}" placeholder="custom packaging" />
          <datalist id="cat-list">${presets.map((p) => `<option value="${p}">`).join('')}</datalist>
        </div>
        <div class="field"><label>细分（可空，逗号分隔）</label><input id="w-sub" value="${esc(profile.sub_niches)}" placeholder="mailer box, rigid box, tissue paper" /></div>
        <div class="field"><label>目标市场</label>
          <select id="w-market">
            ${['欧美', '美国', '欧洲', '中东', '东南亚', '拉美'].map((m) => `<option ${profile.markets === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>品牌名 / 独立站</label>
          <div class="row tight">
            <input id="w-brand" value="${esc(profile.brand_name)}" placeholder="Packrivo" style="flex:1" />
            <input id="w-site" value="${esc(profile.brand_site)}" placeholder="https://packrivo.com" style="flex:1.4" />
          </div>
        </div>
      </div>
      <div class="grid g2" style="margin-top:12px">
        <div class="field"><label>同行 / 竞品域名（一行一个，可留空）</label>
          <textarea id="w-comp" placeholder="packhelp.com&#10;noissue.com">${esc((profile.competitors || []).join('\n'))}</textarea>
        </div>
        <div class="field"><label>种子关键词（逗号分隔，留空用默认 20 个）</label>
          <textarea id="w-kw" placeholder="custom mailer box, kraft packaging">${esc((profile.keywords || []).join(', '))}</textarea>
        </div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn primary" id="w-save-run">保存并抓取情报</button>
        <button class="btn ghost" id="w-save-only">只保存</button>
        <span class="muted" id="w-status"></span>
      </div>
    </div>`;
}

async function bindSetup(profile) {
  const payload = () => ({
    category: $('#w-category').value.trim(),
    sub_niches: $('#w-sub').value.trim(),
    markets: $('#w-market').value,
    brand_name: $('#w-brand').value.trim(),
    brand_site: $('#w-site').value.trim(),
    competitors: ($('#w-comp').value || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    keywords: ($('#w-kw').value || '').split(/[,，\n]/).map((s) => s.trim()).filter(Boolean),
    ready: true,
  });
  const save = async () => {
    const p = payload();
    if (!p.category) throw new Error('类目必填');
    await api('/api/workspace', 'PUT', p);
    return p;
  };
  $('#w-save-only').onclick = async () => {
    try { await save(); toast('已保存'); viewRadar(); } catch (e) { toast(e.message, true); }
  };
  $('#w-save-run').onclick = async () => {
    const btn = $('#w-save-run');
    btn.disabled = true;
    try {
      await save();
      await runRadarRefresh(btn, $('#w-status'));
    } catch (e) {
      toast(e.message, true);
      $('#w-status').textContent = '';
      btn.disabled = false;
    }
  };
}

const RADAR_TABS = [
  ['overview', '概览'], ['videos', '视频'], ['posts', '帖子'], ['articles', '文章'], ['products', '商品'],
  ['keywords', '关键词'], ['competitors', '同行网站'], ['sources', '来源状态'],
];

function keepItems(arr) {
  return (arr || []).filter((x) => !x.ai || x.ai.verdict !== 'drop');
}

function thumbUrl(u) {
  const s = String(u || '').trim();
  return s ? '/api/thumb?u=' + encodeURIComponent(s) : '';
}

function thumbDiv(url, cls, label) {
  const u = thumbUrl(url);
  if (!u) return `<div class="${cls}" style="display:grid;place-items:center;color:var(--muted);font-size:12px">${esc(label || '无图')}</div>`;
  return `<div class="${cls}" style="background-image:url('${esc(u)}')"></div>`;
}

async function viewRadar() {
  const { radar, profile, fetched_at } = await api('/api/radar');
  if (!profile.ready) {
    $('#view').innerHTML = setupForm(profile);
    await bindSetup(profile);
    return;
  }
  const r = radar || { videos: [], posts: [], articles: [], competitors: [], keywords: [], seeds: [] };
  const tab = ST.radarTab || 'overview';

  const counts = {
    videos: r.videos.length, posts: r.posts.length, articles: r.articles.length, products: (r.products || []).length,
    competitors: r.competitors.length,
    keywords: (r.keywords || []).reduce((n, g) => n + g.suggestions.length, 0),
  };
  const subnav = `<div class="subnav">${RADAR_TABS.map(([k, label]) =>
    `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${label}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</button>`).join('')}</div>`;

  const header = `<div class="panel">
    <div class="panel-head">
      <h2>${esc(profile.category)} · ${esc(profile.markets || '欧美')}</h2>
      <div class="row tight">
        <span class="hint">${fetched_at ? '上次抓取 ' + esc(fetched_at) : '还没抓过'}</span>
        <button class="btn ghost tiny" id="r-setup">改类目</button>
        <button class="btn primary tiny" id="r-refresh">刷新情报</button>
      </div>
    </div>
    <div class="pill-list">
      <span class="tag info">竞品 ${profile.competitors.length}</span>
      <span class="tag info">种子词 ${r.seeds ? r.seeds.length : 0}</span>
      <span class="tag ${r.posts.length ? 'ok' : 'mute'}">帖子源 2 个</span>
      <span class="tag mute">TikTok/IG/Reddit 需 Apify</span>
      ${r.audit && r.audit.items && r.audit.items.length ? `<span class="tag ok">kimi 已审 ${r.audit.items.length + (r.audit.keywords || []).length} 条 · 丢弃 ${[...(r.audit.items || []), ...(r.audit.keywords || [])].filter((x) => x.verdict === 'drop').length}</span>` : '<span class="tag mute">AI 未审</span>'}
    </div>
    ${r.audit && r.audit.summary ? `<p class="muted" style="margin:8px 0 0;font-size:11.5px">${esc(r.audit.summary)}</p>` : ''}
  </div>`;

  const cardVideo = (v, i) => `<div class="media-card">
    <a class="thumb" href="${esc(v.url)}" target="_blank" rel="noreferrer" style="background-image:url('${esc(thumbUrl(v.thumb))}')">
      <span class="score">${v.score} 分</span><span class="plat">YouTube</span></a>
    <div class="body">
      <a class="title" href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.title)}</a>
      <div class="meta"><span>${fmt(v.stats?.views || 0)} 播放</span><span>${esc(v.author || '')}</span><span>${v.days >= 999 ? '—' : v.days + ' 天前'}</span></div>
      ${v.ai ? `<div class="muted" style="font-size:10.5px">${v.ai.verdict === 'drop' ? '<span class="tag bad">AI 判丢弃</span>' : '<span class="tag ok">AI ' + v.ai.score + '</span>'} ${esc(v.ai.reason || '')}</div>` : ''}
      <div class="foot"><span class="muted" style="font-size:11px">${v.stats?.duration ? Math.round(v.stats.duration / 60) + ' 分钟' : ''}</span>
        <button class="btn ghost tiny" data-save-video="${r.videos.indexOf(v)}">入库</button></div>
    </div></div>`;

  const cardPost = (p, i) => `<div class="media-card">
    <div class="body" style="gap:8px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div class="row tight" style="align-items:center">
          ${thumbDiv(p.thumb, 'ico', '')}
          <div>
            <div style="font-size:12.5px;font-weight:600">${esc(p.author || '未知作者')}</div>
            <div class="muted" style="font-size:11px">${esc(p.platform)} · ${p.days >= 999 ? '—' : p.days + ' 天前'}</div>
          </div>
        </div>
        <span class="tag ${p.score >= 60 ? 'ok' : 'mute'}">${p.score} 分</span>
      </div>
      <a class="title" href="${esc(p.url)}" target="_blank" rel="noreferrer" style="font-size:12.5px">${esc(p.title)}</a>
      <div class="meta">
        ${p.stats?.fav != null ? `<span>赞 ${fmt(p.stats.fav)}</span><span>转发 ${fmt(p.stats.boost)}</span><span>回复 ${fmt(p.stats.reply)}</span>` : ''}
        ${p.stats?.score != null ? `<span>顶 ${fmt(p.stats.score)}</span><span>评论 ${fmt(p.stats.comments)}</span>` : ''}
      </div>
      ${p.ai ? `<div class="muted" style="font-size:10.5px">${p.ai.verdict === 'drop' ? '<span class="tag bad">AI 判丢弃</span>' : '<span class="tag ok">AI ' + p.ai.score + '</span>'} ${esc(p.ai.reason || '')}</div>` : ''}
      <div class="foot"><span></span><button class="btn ghost tiny" data-save-post="${r.posts.indexOf(p)}">入库</button></div>
    </div></div>`;

  const body = {
    overview: () => `
      <div class="grid g4" style="margin-top:14px">
        <div class="panel kpi"><div class="k">热门视频</div><div class="v">${counts.videos}</div><div class="s">YouTube 精确播放量</div></div>
        <div class="panel kpi"><div class="k">社媒/论坛帖子</div><div class="v">${counts.posts}</div><div class="s">Mastodon + Lemmy 开放接口</div></div>
        <div class="panel kpi"><div class="k">文章 / 话题</div><div class="v">${counts.articles}</div><div class="s">Google News</div></div>
        <div class="panel kpi"><div class="k">同行网站</div><div class="v">${counts.competitors}</div><div class="s">标题/平台/RSS 更新</div></div>
      </div>
      <div class="split" style="margin-top:14px">
        <div class="panel"><div class="panel-head"><h2>最热的视频</h2><button class="btn ghost tiny" data-goto="videos">全部</button></div>
          <div class="media-grid">${keepItems(r.videos).slice(0, 3).map(cardVideo).join('') || '<div class="empty">没抓到</div>'}</div></div>
        <div class="panel"><div class="panel-head"><h2>最新帖子</h2><button class="btn ghost tiny" data-goto="posts">全部</button></div>
          <div>${keepItems(r.posts).slice(0, 4).map((p) => `<div class="list-row">${thumbDiv(p.thumb, 'ico', '')}
            <div style="flex:1"><a href="${esc(p.url)}" target="_blank" rel="noreferrer" style="font-size:12.5px">${esc((p.title || '').slice(0, 90))}</a>
            <div class="muted" style="font-size:11px">${esc(p.platform)} · ${esc(p.author)} · ${p.score} 分</div></div></div>`).join('') || '<div class="empty">没抓到</div>'}</div></div>
      </div>`,
    videos: () => `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>热门视频 · ${counts.videos}</h2><div class="row tight"><span class="hint">按分数排序 · 已按 kimi 判定过滤 ${r.videos.length - keepItems(r.videos).length} 条</span><button class="btn ghost tiny" data-reroll="videos">换一批</button></div></div>
      <div class="media-grid">${keepItems(r.videos).map(cardVideo).join('') || `<div class="empty" style="grid-column:1/-1">
      <div>没有通过质检的视频</div>
      ${r.videos.length ? `<div style="text-align:left;margin-top:8px">${r.videos.map((x) => `<div class="muted" style="font-size:11.5px">· ${esc((x.title || '').slice(0, 56))} — ${esc(x.ai?.reason || '')}</div>`).join('')}</div>` : ''}
    </div>`}</div></div>`,
    posts: () => `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>帖子 · ${counts.posts}</h2><div class="row tight"><span class="hint">Bluesky / Mastodon / Lemmy · 已过滤 ${r.posts.length - keepItems(r.posts).length} 条</span><button class="btn ghost tiny" data-reroll="posts">换一批</button></div></div>
      <div class="media-grid">${keepItems(r.posts).map(cardPost).join('') || `<div class="empty" style="grid-column:1/-1">
        <div style="margin-bottom:8px">Mastodon / Lemmy 这次没有通过质检的帖子</div>
        ${r.posts.length ? `<div style="text-align:left;margin-top:8px">
          <div class="nav-label" style="padding-left:0">kimi 判丢弃的 ${r.posts.length} 条及理由</div>
          ${r.posts.map((x) => `<div class="muted" style="font-size:11.5px;padding:2px 0">· ${esc((x.title || '').slice(0, 60))} — ${esc(x.ai?.reason || '无理由')}</div>`).join('')}
        </div>` : '<div class="muted" style="margin-top:6px">这次一条帖子都没抓到</div>'}
      </div>`}</div>
      <p class="muted" style="margin-top:12px;font-size:11.5px">TikTok / IG / Reddit / FB 群组没有开放搜索接口：Reddit JSON 403、其余需登录态。要么填 Apify Token，要么走浏览器会话（二期）。</p></div>`,
    articles: () => `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>文章 / 话题 · ${counts.articles}</h2><div class="row tight"><span class="hint">Google News · 已过滤 ${r.articles.length - keepItems(r.articles).length} 条</span><button class="btn ghost tiny" data-reroll="articles">换一批</button></div></div>
      ${keepItems(r.articles).map((a) => `<div class="list-row">${thumbDiv(a.thumb, 'ico', '文')}
        <div style="flex:1"><a href="${esc(a.url)}" target="_blank" rel="noreferrer" style="font-size:12.5px">${esc(a.title)}</a>
        <div class="muted" style="font-size:11px">${esc(a.author || '')} · ${a.days >= 999 ? '—' : a.days + ' 天前'} · 估 ${a.score}
          ${a.ai ? (a.ai.verdict === 'drop' ? ' · <span class="tag bad">AI 判丢弃</span>' : ' · <span class="tag ok">AI ' + a.ai.score + '</span>') : ''}
          ${a.ai && a.ai.reason ? '<br>' + esc(a.ai.reason) : ''}</div></div>
        <button class="btn ghost tiny" data-save-article="${r.articles.indexOf(a)}">入库</button></div>`).join('') || '<div class="empty">没抓到文章</div>'}</div>`,
    products: () => {
      const num = (s) => {
        const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([kKmM])?/);
        if (!m) return 0;
        let v = parseFloat(m[1]);
        if (m[2]) v *= /k/i.test(m[2]) ? 1000 : 1000000;
        return v;
      };
      const list = [...(r.products || [])].sort((a, b) => num(b.bought) - num(a.bought) || num(b.reviews) - num(a.reviews));
      const unitPrice = (g) => {
        const pr = parseFloat(String(g.price || '').replace(/[^0-9.]/g, ''));
        const m = String(g.title || '').match(/(\d{1,4})\s*(?:pcs|pieces|pack|set|count)/i);
        const n = m ? parseInt(m[1], 10) : 0;
        return pr && n > 1 ? '$' + (pr / n).toFixed(2) : '—';
      };
      return `<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>商品样本 · ${list.length}</h2><div class="row tight"><span class="hint">Amazon 搜索（浏览器自动化）· 按「月销」排序</span><button class="btn ghost tiny" id="alibaba-warm">阿里过人机验证</button><button class="btn ghost tiny" data-reroll="products">换一批</button></div></div>
      ${list.length ? `<table class="prod-table"><thead><tr><th style="width:64px">图</th><th>产品</th><th style="width:90px">价格</th><th style="width:96px">单价/件</th><th style="width:76px">评分</th><th style="width:96px">评价数</th><th style="width:92px">月销</th><th style="width:86px">来源</th><th style="width:70px"></th></tr></thead><tbody>
        ${list.map((g) => `<tr>
          <td>${g.thumb ? `<img src="/api/thumb?u=${encodeURIComponent(g.thumb)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px" loading="lazy" />` : '<span class="muted">—</span>'}</td>
          <td><a href="${esc(g.url)}" target="_blank" rel="noreferrer">${esc((g.title || '').slice(0, 96))}</a></td>
          <td class="num">${esc(g.price || '—')}</td>
          <td class="num">${unitPrice(g)}</td>
          <td class="num">${g.rating ? '★ ' + g.rating : '—'}</td>
          <td class="num">${g.reviews ? fmt(g.reviews) : '—'}</td>
          <td class="num">${esc(g.bought || g.moq || '—')}</td>
          <td><span class="tag ${g.source === 'amazon' ? 'info' : 'warn'}">${g.source === 'amazon' ? 'Amazon' : 'Alibaba'}</span></td>
          <td><a class="btn ghost tiny" href="${esc(g.url)}" target="_blank" rel="noreferrer">打开</a></td>
        </tr>`).join('')}
      </tbody></table>` : '<div class="empty">商品还没抓到（Amazon 可能有验证码，换一批试试）</div>'}
      <p class="muted" style="margin-top:12px;font-size:12px">价格为抓取当天的搜索页标价；「月销」是 Amazon 的 "bought in past month"；评价数为页面显示值，个别商品可能抓不全。</p>
    </div>`;
    },
    keywords: () => `<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>关键词机会 · ${counts.keywords}</h2><span class="hint">无免费搜索量接口：用「联想位次 + AI 相关性分」代替，点趋势看 Google 真实曲线</span></div>
      ${(r.keywords || []).map((g) => {
        const rows = (g.suggestions || []);
        const keepRows = rows.filter((x) => !x.ai || x.ai.verdict !== 'drop');
        return `<div style="margin-bottom:16px">
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="nav-label" style="padding-left:0">${esc(g.seed)} · ${rows.length} 个，AI 留下 ${keepRows.length}</div>
            <button class="btn ghost tiny" data-add-kw="${esc(g.seed)}">把留下的加入关键词库</button>
          </div>
          <table><thead><tr><th>关键词</th><th>联想位次</th><th>AI 相关性</th><th>判定</th><th>趋势</th></tr></thead><tbody>
          ${rows.map((x) => `<tr>
            <td>${esc(x.word || x)}</td>
            <td class="num">#${x.position || '-'}</td>
            <td class="num">${x.ai ? x.ai.score : '—'}</td>
            <td>${!x.ai ? '<span class="tag mute">未审</span>' : x.ai.verdict === 'drop' ? '<span class="tag bad">丢弃</span>' : `<span class="tag ok">保留</span><div class="muted" style="font-size:10.5px">${esc(x.ai.reason || '')}</div>`}</td>
            <td><a class="btn ghost tiny" href="https://trends.google.com/trends/explore?q=${encodeURIComponent(x.word || x)}&geo=US" target="_blank" rel="noreferrer">看趋势</a></td>
          </tr>`).join('')}
          </tbody></table>
        </div>`;
      }).join('') || '<div class="empty">没抓到联想词</div>'}
    </div>`,
    competitors: () => `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>同行网站 · ${counts.competitors}</h2><span class="hint">标题/描述/建站平台/最近更新</span></div>
      <div class="row" style="margin-bottom:12px"><div class="field" style="flex:1"><label>加一个同行域名</label><input id="c-domain" placeholder="noissue.com" /></div>
        <button class="btn ghost" id="c-add">抓取并加入</button></div>
      <div class="media-grid">${r.competitors.map((s) => `<div class="media-card"><div class="body">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div class="row tight" style="align-items:center">${thumbDiv('https://www.google.com/s2/favicons?domain=' + s.domain + '&sz=64', 'ico', '')}
            <div><div style="font-weight:600;font-size:12.5px">${esc(s.domain)}</div><div class="muted" style="font-size:11px">${esc(s.platform)}</div></div></div>
          <button class="btn danger tiny" data-del-comp="${esc(s.domain)}">移出</button></div>
        <a class="title" href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title || s.url)}</a>
        <div class="meta"><span>${esc((s.description || '').slice(0, 80))}</span></div>
        ${s.posts.length ? `<div class="muted" style="font-size:11px">最近更新：${s.posts.map((t) => esc(t.slice(0, 40))).join(' · ')}</div>` : '<div class="muted" style="font-size:11px">没找到 RSS</div>'}
      </div></div>`).join('') || '<div class="empty">还没加同行</div>'}</div></div>`,
    sources: () => {
      const list = [
        ['YouTube 视频', 'yt-dlp', 'ok', '精确播放量/时长/简介，已跑通'],
        ['Mastodon 帖子', 'mastodon.social 标签时间线', 'ok', '公开接口，带赞/转/回复数与媒体图'],
        ['Lemmy 论坛帖', 'lemmy.world search', 'ok', '开放接口，带分数与评论数；按相关性过滤'],
        ['Google News 文章', 'news.google.com RSS', 'ok', '标题/媒体/时间，无互动数据'],
        ['关键词联想', 'suggestqueries.google.com', 'ok', '无 key 长尾词'],
        ['同行站点', '直抓首页 + RSS', 'ok', '标题/描述/建站平台/最近文章'],
        ['TikTok / IG / Reddit / FB 群组', '—', 'bad', '无开放搜索：Reddit JSON 403，其余需登录态 → Apify 或浏览器会话'],
        ['X / Threads / Pinterest', '—', 'bad', '需付费档或应用审核，暂未接'],
      ];
      return `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>来源状态</h2><span class="hint">哪些真能用、哪些是硬限制</span></div>
        <table><thead><tr><th>来源</th><th>用的什么</th><th>状态</th><th>说明</th></tr></thead><tbody>
        ${list.map(([n, via, s, note]) => `<tr><td>${esc(n)}</td><td class="mono muted">${esc(via)}</td>
          <td><span class="tag ${s === 'ok' ? 'ok' : 'bad'}">${s === 'ok' ? '可用' : '不可用'}</span></td><td class="muted">${esc(note)}</td></tr>`).join('')}
        </tbody></table></div>`;
    },
  }[tab] || (() => '<div class="empty">未知子版块</div>');

  $('#view').innerHTML = header + subnav + body();

  $$('[data-tab]').forEach((b) => (b.onclick = () => { ST.radarTab = b.dataset.tab; history.replaceState(null, '', '#radar/' + b.dataset.tab); viewRadar(); }));
  $$('[data-goto]').forEach((b) => (b.onclick = () => { ST.radarTab = b.dataset.goto; viewRadar(); }));
  $$('[data-reroll]').forEach((b) => (b.onclick = async () => {
    const scope = b.dataset.reroll;
    b.disabled = true; b.textContent = '换一批…';
    try {
      const r = await api('/api/radar/reroll', 'POST', { scope });
      if (r.fallback) toast('没有更多新的了，保留当前这批；再点「刷新情报」会重新抓');
      else toast('已换 ' + r.count + ' 条新内容');
      viewRadar();
    } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = '换一批'; }
  }));

  const refresh = $('#r-refresh');
  if (refresh) refresh.onclick = async () => {
    refresh.disabled = true; refresh.textContent = '抓取中…';
    try { await runRadarRefresh(refresh, $('#w-status')); }
    catch (e) { toast(e.message, true); refresh.disabled = false; refresh.textContent = '刷新情报'; }
  };
  const setup = $('#r-setup');
  if (setup) setup.onclick = async () => { await api('/api/workspace', 'PUT', { ready: false }).catch(() => {}); viewRadar(); };

  $$('[data-save-video]').forEach((b) => (b.onclick = async () => {
    const v = r.videos[Number(b.dataset.saveVideo)];
    await saveHotspots([{ ...v, keyword: v.keyword || profile.category }]);
    b.disabled = true; b.textContent = '已入库';
  }));
  $$('[data-save-post]').forEach((b) => (b.onclick = async () => {
    const p = r.posts[Number(b.dataset.savePost)];
    await saveHotspots([{ ...p, keyword: p.keyword || profile.category }]);
    b.disabled = true; b.textContent = '已入库';
  }));
  $$('[data-save-article]').forEach((b) => (b.onclick = async () => {
    const a = r.articles[Number(b.dataset.saveArticle)];
    await saveHotspots([{ ...a, keyword: a.keyword || profile.category }]);
    b.disabled = true; b.textContent = '已入库';
  }));
  $$('[data-add-kw]').forEach((b) => (b.onclick = async () => {
    const g = (r.keywords || []).find((x) => x.seed === b.dataset.addKw);
    if (!g) return;
    const { keywords } = await api('/api/keywords');
    const words = (g.suggestions || []).filter((x) => !x.ai || x.ai.verdict !== 'drop').map((x) => x.word || x);
    const merged = [...new Set([...keywords, ...words])];
    await api('/api/workspace', 'PUT', { keywords: merged, ready: true });
    toast(`关键词库已扩到 ${merged.length} 个`);
  }));
  $$('[data-del-comp]').forEach((b) => (b.onclick = async () => {
    await api('/api/radar/competitor/' + encodeURIComponent(b.dataset.delComp), 'DELETE');
    toast('已移出'); viewRadar();
  }));
  const addComp = $('#c-add');
  if (addComp) addComp.onclick = async () => {
    const domain = $('#c-domain').value.trim();
    if (!domain) return toast('填个域名', true);
    addComp.disabled = true; addComp.textContent = '抓取中…';
    try { const res = await api('/api/radar/competitor', 'POST', { domain }); toast(`已加入 ${res.competitor.domain}`); viewRadar(); }
    catch (e) { toast(e.message, true); addComp.disabled = false; addComp.textContent = '抓取并加入'; }
  };
}
/* ================= 路由 ================= */
const VIEWS = {
  radar: [viewRadar, '情报雷达', '先填类目，再一键抓热门视频 / 文章 / 同行 / 关键词'],
  overview: [viewOverview, '总览', '今天该干什么，一眼看到'],
  platforms: [viewPlatforms, '平台覆盖', '社媒 / 论坛 / B2B / 私信，哪些已通、哪些差什么'],
  hotspots: [viewHotspots, '爆款库', '关键词 → 参考帖 → 结构拆解'],
  workflow: [viewWorkflow, '工作流', '七步固定流程，卡在哪一步一眼看到'],
  products: [viewProducts, '产品与素材', '卖点写一次，反复用'],
  knowledge: [viewKnowledge, '知识库', '品牌/产品/客户/语气/术语/禁词——AI 每次生成都会读'],
  generate: [viewGenerate, 'AI 二创', '一稿多平台，按平台换文体'],
  review: [viewReview, '审核队列', '敏感项强制人工，其余看模式'],
  schedule: [viewSchedule, '排期', '按平台限速排队发送'],
  results: [viewResults, '发布结果', '成功与失败归因'],
  analytics: [viewAnalytics, '数据看板', '发布后跟踪：曝光 / 互动 / 引流 / 金额'],
  accounts: [viewAccounts, '账号', '平台账号与代理绑定'],
  models: [viewModels, '模型接入', '文字 / 图片 / 视频接口'],
  ledger: [viewLedger, '状态台账', '哪些已跑通，缺什么'],
  settings: [viewSettings, '设置', '发布模式、品牌、外部对接'],
};

async function go(view) {
  ST.view = view;
  const [fn, title, sub] = VIEWS[view] || VIEWS.overview;
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $('#title').textContent = title;
  $('#subtitle').textContent = sub;
  try { await fn(); } catch (e) {
    $('#view').innerHTML = `<div class="panel"><div class="tag bad">加载失败：${esc(e.message)}</div><p class="muted">服务是否在 127.0.0.1:8795 上运行？</p></div>`;
  }
  try {
    const c = await api('/api/contents?status=pending_review');
    const n = c.contents.length;
    const badge = $('#badge-review');
    badge.textContent = n;
    badge.classList.toggle('zero', n === 0);
  } catch {}
}

$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) go(b.dataset.view);
});
$('#btn-refresh').onclick = () => go(ST.view);
$('#btn-tick').onclick = async () => {
  try { await api('/api/tick', 'POST'); toast('已跑一轮队列'); go(ST.view); } catch (e) { toast(e.message, true); }
};

let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => { if (ST.view === 'analytics') viewAnalytics(); }, 200);
});


function applyTheme(mode) {
  const m = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', m);
  try { localStorage.setItem('swb-theme', m); } catch {}
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = m === 'light' ? '深色' : '浅色';
}

function initTheme() {
  let saved = 'dark';
  const qp = new URLSearchParams(location.search).get('theme');
  try { saved = qp || localStorage.getItem('swb-theme') || 'dark'; } catch { saved = qp || 'dark'; }
  applyTheme(saved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(cur);
  };
}

(async () => {
  initTheme();
  try { ST.platforms = (await api('/api/platforms')).platforms; } catch {}
  try {
    const h = await api('/api/health');
    $('#health').textContent = '在线 · v' + h.version;
    $('#health-dot').className = 'dot ok';
  } catch {
    $('#health').textContent = '服务未启动';
    $('#health-dot').className = 'dot bad';
  }
  let target = (location.hash || '').slice(1);
  if (/^radar\/\w+$/.test(target)) { ST.radarTab = target.split('/')[1]; target = 'radar'; }
  if (!target) {
    try {
      const ws = await api('/api/workspace');
      target = ws.profile.ready ? 'overview' : 'radar';
    } catch { target = 'overview'; }
  }
  await go(target || 'overview');
})();


/* 情报刷新：后台异步抓 + 轮询进度（避免点了按钮像没反应） */
async function runRadarRefresh(btn, statusEl) {
  if (btn) { btn.disabled = true; btn.textContent = '抓取中…'; }
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
  try {
    const start = await api('/api/radar/refresh', 'POST', {});
    setStatus(start.started ? '抓取中：准备…' : ('上一轮还在抓：' + (start.stage || '') + '，稍等…'));
    await new Promise((resolve) => {
      const timer = setInterval(async () => {
        try {
          const st = await api('/api/radar/refresh');
          if (st.running) { setStatus('抓取中：' + (st.stage || '…') + '（这步要几十秒）'); return; }
          clearInterval(timer);
          if (st.error) { toast('抓取失败：' + st.error, true); setStatus(''); }
          else {
            const n = st.counts || {};
            toast('情报已更新：视频 ' + (n.videos || 0) + ' · 帖子 ' + (n.posts || 0) + ' · 文章 ' + (n.articles || 0) + ' · 商品 ' + (n.products || 0));
            setStatus('');
          }
          resolve();
        } catch (e) { clearInterval(timer); toast(e.message, true); setStatus(''); resolve(); }
      }, 3000);
    });
    viewRadar();
  } catch (e) {
    toast(e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = '刷新情报'; }
    setStatus('');
  }
}
