import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [], miss = [];
const rep = (n, a, b) => { if (!c.includes(a)) { miss.push(n); return; } c = c.replace(a, b); done.push(n); };

/* ---- 1. 总览：已发/测试发送分开 + 示例角标 ---- */
rep('kpi-publish',
  '<div class="k">待发 / 已发</div>\n        <div class="v">${ov.counts.scheduled} <span style="font-size:15px;color:var(--muted)">/ ${ov.counts.published}</span></div>\n        <div class="s">排期中 / 发布成功</div>',
  '<div class="k">待发 / 真实已发</div>\n        <div class="v">${ov.counts.scheduled} <span style="font-size:15px;color:var(--muted)">/ ${ov.counts.published}</span></div>\n        <div class="s">测试发送 ${ov.counts.published_test || 0} 条（本地 mock，不算真实发布）</div>');

rep('kpi-impressions',
  '<div class="k">30 天曝光</div>',
  '<div class="k">30 天曝光${ov.counts.demoMetrics ? \' <span class="tag warn">示例</span>\' : \'\'}</div>');

rep('kpi-engagement',
  '<div class="k">互动率</div>',
  '<div class="k">互动率${ov.counts.demoMetrics ? \' <span class="tag warn">示例</span>\' : \'\'}</div>');

/* ---- 2. 总览：只突出 4 个平台 ---- */
rep('focus-platforms',
  `      \${(() => {
        const runnable = plat.platforms.filter((p) => p.channel_state === 'ready' || p.channel_state === 'pending_config' || p.accounts > 0);
        const rest = plat.platforms.filter((p) => !runnable.includes(p));
        const restBy = (k) => rest.filter((p) => p.kind === k).length;
        return \`<div class="grid g4">
          \${runnable.map((p) => \`<div class="plat-card \${p.channel_state === 'ready' ? 'ready' : 'pending'}">
            <div class="top"><span class="name">\${esc(p.label)}</span>\${chTag(p.channel_state)}</div>
            <div class="meta"><span>账号 \${p.accounts}</span><span>内容 \${p.contents}</span><span>已发 \${p.published}</span></div>
            <div class="note">\${esc(p.channel_note || '')}</div>
          </div>\`).join('')}
        </div>
        <div class="row" style="margin-top:12px;justify-content:space-between;align-items:center">
          <span class="muted" style="font-size:11.5px">其余 \${rest.length} 个渠道待平台资质或只能浏览器会话：社媒 \${restBy('social')} · 论坛 \${restBy('forum')} · B2B \${restBy('b2b')} · 私信 \${restBy('im')}</span>
          <button class="btn ghost tiny" data-go="platforms">查看全部 \${plat.platforms.length} 个渠道</button>
        </div>\`;
      })()}`,
  `      \${(() => {
        const focus = ['facebook_page', 'instagram', 'tiktok', 'pinterest'];
        const focusList = focus.map((code) => plat.platforms.find((x) => x.code === code)).filter(Boolean);
        const ready = focusList.filter((p) => p.channel_state === 'ready').length;
        const rest = plat.platforms.filter((p) => !focus.includes(p.code));
        const restBy = (k) => rest.filter((p) => p.kind === k).length;
        return \`<div class="muted" style="font-size:12px;margin-bottom:10px">重点 4 个平台：\${ready} 个已接通（其余处于待资质/待联调）</div>
        <div class="grid g4">
          \${focusList.map((p) => \`<div class="plat-card \${p.channel_state === 'ready' ? 'ready' : 'pending'}">
            <div class="top"><span class="name">\${esc(p.label)}</span>\${chTag(p.channel_state)}</div>
            <div class="meta"><span>账号 \${p.accounts}</span><span>内容 \${p.contents}</span><span>已发 \${p.published}</span></div>
            <div class="note">\${esc(p.channel_note || '')}</div>
          </div>\`).join('')}
        </div>
        <details style="margin-top:12px">
          <summary class="muted" style="cursor:pointer;font-size:12px">其余 \${rest.length} 个渠道（社媒 \${restBy('social')} · 论坛 \${restBy('forum')} · B2B \${restBy('b2b')} · 私信 \${restBy('im')}）—— 以后再说</summary>
          <div class="pill-list" style="margin-top:8px">\${rest.map((p) => \`<span class="tag mute">\${esc(p.label)}</span>\`).join('')}</div>
        </details>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost tiny" data-go="platforms">查看全部 \${plat.platforms.length} 个渠道</button></div>\`;
      })()}`);

/* ---- 3. 数据看板：订单金额 → 询盘数 ---- */
rep('kpi-inquiry',
  '<div class="panel kpi warn" style="padding:12px 14px"><div class="k">订单金额</div><div class="v" style="font-size:22px">${fmt(t.orders_amount)}</div></div>',
  '<div class="panel kpi warn" style="padding:12px 14px"><div class="k">询盘数</div><div class="v" style="font-size:22px">${fmt(t.inquiries || 0)}</div><div class="s">手动回填，后续接 GA4 generate_lead</div></div>');

rep('top-posts-col',
  '<th>点击</th><th>引流</th><th>金额</th></tr></thead><tbody>',
  '<th>点击</th><th>引流</th><th>询盘</th></tr></thead><tbody>');

rep('top-posts-cell',
  '<td class="num">${fmt(p.sessions)}</td><td class="num">${fmt(p.orders_amount)}</td></tr>',
  '<td class="num">${fmt(p.sessions)}</td><td class="num">${fmt(p.inquiries || 0)}</td></tr>');

rep('plat-table-col',
  '<th>点击</th><th>引流</th></tr></thead><tbody>',
  '<th>点击</th><th>引流</th><th>询盘</th></tr></thead><tbody>');

rep('plat-table-cell',
  '<td class="num">${pct(pp.engagement_rate)}</td><td class="num">${fmt(pp.clicks)}</td><td class="num">${fmt(pp.sessions)}</td></tr>',
  '<td class="num">${pct(pp.engagement_rate)}</td><td class="num">${fmt(pp.clicks)}</td><td class="num">${fmt(pp.sessions)}</td><td class="num">${fmt(pp.inquiries || 0)}</td></tr>');

/* ---- 4. 询盘输入框 ---- */
rep('inquiry-input',
  '<div class="field" style="max-width:110px"><label>引流会话</label><input id="mx-sess" type="number" min="0" value="0" /></div>',
  '<div class="field" style="max-width:110px"><label>引流会话</label><input id="mx-sess" type="number" min="0" value="0" /></div>\n        <div class="field" style="max-width:100px"><label>询盘数</label><input id="mx-inq" type="number" min="0" value="0" /></div>');

rep('inquiry-save',
  'sessions: $(\'#mx-sess\').value,',
  'sessions: $(\'#mx-sess\').value, inquiries: $(\'#mx-inq\').value,');

/* ---- 5. 账号状态显示未授权 ---- */
rep('account-status-ui',
  '<td>${esc(a.status)}</td><td>${esc(a.session_state)}</td>',
  '<td>${a.status_view === \'已授权\' ? \'<span class="tag ok">已授权</span>\' : \'<span class="tag warn">未授权</span>\'}</td><td>${esc(a.session_state)}</td>');

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
if (miss.length) console.log('MISS:', miss.join(', '));
