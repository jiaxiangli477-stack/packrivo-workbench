import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- 账号页：填凭据 ---------- */
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

rep('cred-btn',
  '<td><button class="btn ghost tiny" data-probe="${a.id}">探测</button>',
  '<td><button class="btn ghost tiny" data-cred="${a.id}" data-plat="${a.platform}">填凭据</button><button class="btn ghost tiny" data-probe="${a.id}">探测</button>');

rep('cred-bind',
  "  $$('[data-probe]').forEach((b) => (b.onclick = async () => {",
  `  $$('[data-cred]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.cred, plat = b.dataset.plat;
    const plan = plat === 'mastodon'
      ? [['instance', '实例域名（如 mastodon.social）'], ['access_token', 'access token']]
      : plat === 'bluesky'
        ? [['handle', 'handle（如 xxx.bsky.social）'], ['app_password', 'app password']]
        : [['field', '字段名'], ['value', '值']];
    try {
      for (const [field, label] of plan) {
        const v = prompt(label);
        if (!v) return;
        await api('/api/accounts/' + id + '/credential', 'POST', { field, value: v.trim() });
      }
      toast('凭据已保存（加密存储）');
      viewAccounts();
    } catch (e) { toast(e.message, true); }
  }));
  $$('[data-probe]').forEach((b) => (b.onclick = async () => {`);

writeFileSync(p, c, 'utf8');
console.log('ui done:', done.join(', '));
