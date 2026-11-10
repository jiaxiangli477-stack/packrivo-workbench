import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- 1) 探测通过时回写主页链接 ---------- */
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(sp, 'utf8');
const d1 = [];
const rep1 = (n, a, b) => { if (!s.includes(a)) { console.log('MISS', n); return; } s = s.replace(a, () => b); d1.push(n); };

rep1('mastodon-profile',
  `      run("update account set session_state = 'ok', handle = ? where id = ?", '@' + j.acct, acc.id);`,
  `      run("update account set session_state = 'ok', handle = ?, profile_url = ? where id = ?",
        '@' + j.acct, 'https://' + instance + '/@' + j.acct, acc.id);`);

rep1('bluesky-profile',
  `      run("update account set session_state = 'ok', handle = ? where id = ?", '@' + j.handle, acc.id);`,
  `      run("update account set session_state = 'ok', handle = ?, profile_url = ? where id = ?",
        '@' + j.handle, 'https://bsky.app/profile/' + j.handle, acc.id);`);

writeFileSync(sp, s, 'utf8');
console.log('server:', d1.join(', '));

/* ---------- 2) 账号页：打开主页 ---------- */
const ap = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(ap, 'utf8');

if (!c.includes('function accountUrl')) {
  c = c.replace(
    'async function viewAccounts() {',
    `function accountUrl(a) {
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

async function viewAccounts() {`
  );

  c = c.replace(
    '<td><button class="btn ghost tiny" data-cred="${a.id}" data-plat="${a.platform}">填凭据</button>',
    '<td><a class="btn ghost tiny" href="${esc(accountUrl(a))}" target="_blank" rel="noreferrer">打开主页</a><button class="btn ghost tiny" data-cred="${a.id}" data-plat="${a.platform}">填凭据</button>'
  );
  writeFileSync(ap, c, 'utf8');
  console.log('ui: account jump link added');
}
