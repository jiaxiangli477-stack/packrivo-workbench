import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const lines = c.split('\n');

/* ---- 1) 表格：加「填凭据」展开行 ---- */
const tableStart = c.indexOf('      ${accounts.length ? `<table><thead><tr><th>#</th>');
const tableEndMark = '</tbody></table>` : \'<div class="empty">还没有账号';
const tableEnd = c.indexOf(tableEndMark);
if (tableStart < 0 || tableEnd < 0) { console.log('table anchors missing'); process.exit(1); }

const tableBlock = [
  '      ${accounts.length ? `<table><thead><tr><th>#</th><th>平台</th><th>handle</th><th>状态</th><th>会话</th><th>代理</th><th>凭据</th><th></th></tr></thead><tbody>',
  '        ${accounts.map((a) => `<tr><td class="mono">${a.id}</td><td>${esc(pname(a.platform))}</td><td>${esc(a.handle)}</td>',
  '          <td>${a.status_view === \'已授权\' ? \'<span class="tag ok">已授权</span>\' : \'<span class="tag warn">未授权</span>\'}</td><td>${esc(a.session_state)}</td><td class="mono">${esc(a.proxy || \'—\')}</td><td>${a.cred_count}</td>',
  '          <td><button class="btn ghost tiny" data-cred="${a.id}" data-plat="${a.platform}">填凭据</button><button class="btn ghost tiny" data-probe="${a.id}">探测</button><button class="btn danger tiny" data-dela="${a.id}">删</button></td></tr>',
  '        <tr class="cred-form" id="cred-${a.id}" style="display:none"><td colspan="8" style="background:var(--surface-2)">',
  '          <div class="row" style="align-items:flex-end;gap:10px;padding:6px 0">',
  '            ${(a.platform === \'bluesky\'',
  '              ? [["handle","handle（如 packrivo.bsky.social）","packrivo.bsky.social"],["app_password","App Password（xxxx-xxxx-xxxx-xxxx）","xxxx-xxxx-xxxx-xxxx"]]',
  '              : a.platform === \'mastodon\'',
  '                ? [["instance","实例域名（如 mastodon.social）","mastodon.social"],["access_token","access token","粘贴 token"]]',
  '                : [["field","字段名",""],["value","值",""]]',
  '            ).map(([f, label, ph]) => `<div class="field" style="flex:1"><label>${label}</label><input id="cf-${a.id}-${f}" placeholder="${ph}" /></div>`).join(\'\')}',
  '            <button class="btn primary tiny" data-cred-save="${a.id}" data-plat="${a.platform}">保存并验证</button>',
  '          </div>',
  '          <div class="muted" id="cred-msg-${a.id}" style="font-size:12px">${a.platform === \'bluesky\' ? \'App Password 在 Bluesky 设置里生成，不是你的登录密码\' : a.platform === \'mastodon\' ? \'token 在实例的 Preferences → Development 里生成，勾 write 权限\' : \'\'}</div>',
  '        </td></tr>`).join(\'\')}',
  '      ',
].join('\n');

c = c.slice(0, tableStart) + tableBlock + c.slice(tableEnd);

/* ---- 2) 绑定：展开 + 保存并验证 ---- */
const bindStart = c.indexOf("  $$('[data-cred]').forEach((b) => (b.onclick = async () => {");
const bindEndMark = "  $$('[data-probe]').forEach((b) => (b.onclick = async () => {";
const bindEnd = c.indexOf(bindEndMark);
if (bindStart < 0 || bindEnd < 0) { console.log('bind anchors missing'); process.exit(1); }

const bindBlock = [
  "  $$('[data-cred]').forEach((b) => (b.onclick = () => {",
  "    const row = $('#cred-' + b.dataset.cred);",
  "    if (row) row.style.display = row.style.display === 'none' || !row.style.display ? 'table-row' : 'none';",
  "  }));",
  "  $$('[data-cred-save]').forEach((b) => (b.onclick = async () => {",
  "    const id = b.dataset.credSave;",
  "    const inputs = Array.from(document.querySelectorAll('[id^=\"cf-' + id + '-\"]'));",
  "    const msg = $('#cred-msg-' + id);",
  "    b.disabled = true; b.textContent = '保存中…';",
  "    try {",
  "      for (const inp of inputs) {",
  "        const field = inp.id.replace('cf-' + id + '-', '');",
  "        if (!inp.value.trim()) continue;",
  "        await api('/api/accounts/' + id + '/credential', 'POST', { field, value: inp.value.trim() });",
  "      }",
  "      const r = await api('/api/accounts/' + id + '/probe', 'POST');",
  "      if (msg) msg.innerHTML = r.ok ? '<span class=\"tag ok\">验证通过</span> ' + esc(r.reason) : '<span class=\"tag bad\">没通过</span> ' + esc(r.reason);",
  "      toast(r.ok ? '凭据已验证' : r.reason, !r.ok);",
  "      if (r.ok) setTimeout(viewAccounts, 900);",
  "    } catch (e) { if (msg) msg.innerHTML = '<span class=\"tag bad\">' + esc(e.message) + '</span>'; toast(e.message, true); }",
  "    b.disabled = false; b.textContent = '保存并验证';",
  "  }));",
  "",
].join('\n');

c = c.slice(0, bindStart) + bindBlock + c.slice(bindEnd);

writeFileSync(p, c, 'utf8');
console.log('accounts credential form rewritten');
