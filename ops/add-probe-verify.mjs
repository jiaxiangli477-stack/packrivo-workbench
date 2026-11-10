import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');

const old = `on('POST', /^\\/api\\/accounts\\/(\\d+)\\/probe$/, async (m) => {
  const acc = get('select * from account where id = ?', Number(m[1]));
  if (!acc) throw new Error('账号不存在');
  run("update account set session_state = 'pending_integration' where id = ?", acc.id);
  return {
    ok: false,
    state: 'pending_integration',
    reason: '登录态探测需要浏览器会话模块（独立 profile + 代理），当前版本未接入，先在平台侧人工确认账号状态',
  };
});`;

const neu = `on('POST', /^\\/api\\/accounts\\/(\\d+)\\/probe$/, async (m) => {
  const acc = get('select * from account where id = ?', Number(m[1]));
  if (!acc) throw new Error('账号不存在');

  const cred = (field) => {
    const r = get("select cipher from credential where owner_kind = 'account' and owner_id = ? and field = ? order by id desc limit 1", acc.id, field);
    if (!r) return null;
    try { return decrypt(r.cipher); } catch { return null; }
  };
  const mark = (state, extra) => run('update account set session_state = ? where id = ?', state, acc.id) && { state, ...extra };

  if (acc.platform === 'mastodon') {
    const instance = (cred('instance') || (acc.profile_url || '').replace(/^https?:\\/\\//, '').split('/')[0] || '').replace(/\\/$/, '');
    const token = cred('access_token');
    if (!instance || !token) return mark('missing_credential', { ok: false, reason: '缺 instance 或 access_token，先点「填凭据」' });
    try {
      const r = await fetch('https://' + instance + '/api/v1/accounts/verify_credentials', { headers: { authorization: 'Bearer ' + token } });
      if (!r.ok) return mark('auth_failed', { ok: false, reason: 'Mastodon 验证失败 HTTP ' + r.status });
      const j = await r.json();
      run("update account set session_state = 'ok', handle = ? where id = ?", '@' + j.acct, acc.id);
      return { ok: true, state: 'ok', reason: '已验证：@' + j.acct };
    } catch (e) {
      return mark('network_error', { ok: false, reason: '连不上 ' + instance + '：' + e.message });
    }
  }

  if (acc.platform === 'bluesky') {
    const handle = cred('handle') || (acc.handle || '').replace(/^@/, '');
    const pw = cred('app_password');
    if (!handle || !pw) return mark('missing_credential', { ok: false, reason: '缺 handle 或 app_password，先点「填凭据」' });
    try {
      const r = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: handle, password: pw }),
      });
      if (!r.ok) return mark('auth_failed', { ok: false, reason: 'Bluesky 登录失败 HTTP ' + r.status });
      const j = await r.json();
      run("update account set session_state = 'ok', handle = ? where id = ?", '@' + j.handle, acc.id);
      return { ok: true, state: 'ok', reason: '已验证：@' + j.handle };
    } catch (e) {
      return mark('network_error', { ok: false, reason: '连不上 bsky.social：' + e.message });
    }
  }

  run("update account set session_state = 'pending_integration' where id = ?", acc.id);
  return {
    ok: false,
    state: 'pending_integration',
    reason: '这个平台还没有直连通道（Mastodon / Bluesky 已支持），要么走 Postiz，要么等浏览器会话模块',
  };
});`;

if (!s.includes(old)) { console.log('anchor missing'); process.exit(1); }
s = s.replace(old, neu);
writeFileSync(p, s, 'utf8');
console.log('probe: real verification for mastodon/bluesky');
