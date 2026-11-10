import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
const lines = readFileSync(p, 'utf8').split('\n');

const idx = lines.findIndex((l) => l.includes('data-dela'));
if (idx < 0) { console.log('no data-dela line'); process.exit(1); }

/* 从 data-dela 行往下找第一个单独的 } —— 那是 viewAccounts 的结尾 */
let end = -1;
for (let i = idx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '}') { end = i; break; }
}
if (end < 0) { console.log('no closing brace'); process.exit(1); }

const guide = [
  '',
  "  /* 各平台授权入口：点开平台官方页面拿凭据 */",
  "  $('#view').insertAdjacentHTML('beforeend', `",
  '    <div class="panel" style="margin-top:14px">',
  '      <div class="panel-head"><h2>各平台绑定入口</h2><span class="hint">先点「打开授权页」到平台官方页面拿凭据，回来在这条账号上点「填凭据」粘贴</span></div>',
  '      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px">',
  "        ${['bluesky','telegram','mastodon','facebook_page','instagram','threads','tiktok','pinterest','x','linkedin','youtube','reddit']",
  '          .filter((k) => PLATFORM_AUTH[k])',
  '          .map((k) => {',
  '            const v = PLATFORM_AUTH[k];',
  '            return `<div class="panel" style="background:var(--surface-2);padding:12px">',
  '              <div class="row" style="justify-content:space-between;align-items:center;gap:8px">',
  '                <strong>${esc(pname(k) || k)}</strong>',
  '                <a class="btn tiny" href="${v.url}" target="_blank" rel="noreferrer">打开授权页</a>',
  '              </div>',
  '              <div class="muted" style="font-size:12.5px;margin-top:6px">需要：${esc(v.need)}</div>',
  "              ${v.note ? `<div class=\"muted\" style=\"font-size:12px;margin-top:4px\">${esc(v.note)}</div>` : ''}",
  '            </div>`;',
  "          }).join('')}",
  '      </div>',
  '      <p class="muted" style="margin-top:10px;font-size:12px">FB / IG / Threads / TikTok / Pinterest 都要 App 审核；审核期间先用 Bluesky 和 Telegram 跑流程。</p>',
  '    </div>`);',
].join('\n');

lines.splice(end, 0, guide);
writeFileSync(p, lines.join('\n'), 'utf8');
console.log('guide inserted before line', end + 1);
