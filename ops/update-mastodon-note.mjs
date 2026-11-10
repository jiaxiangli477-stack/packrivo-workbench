import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');
const old = "mastodon: { url: 'https://mastodon.social/settings/applications', need: '实例应用 + access token（write 权限）', note: '换成你自己的实例域名再打开这个路径' },";
const neu = "mastodon: { url: 'https://mastodon.social/settings/applications', need: '实例应用 + access token（write 权限）', note: '应用名填 Packrivo；网站填 https://www.packrivo.com；重定向 URI 保留 urn:ietf:wg:oauth:2.0:oob；权限勾 write（read 可一并勾）。提交后复制「你的访问令牌」' },";
if (!c.includes(old)) { console.log('MISS mastodon note'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('mastodon guide note updated');