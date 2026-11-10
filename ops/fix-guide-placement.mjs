import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let lines = readFileSync(p, 'utf8').split('\n');

/* 1) 先删掉插错位置的块 */
const start = lines.findIndex((l) => l.includes('各平台授权入口'));
if (start < 0) { console.log('block not found'); process.exit(1); }
let stop = -1;
for (let i = start; i < lines.length; i++) {
  if (lines[i].trim().startsWith('</div>`);')) { stop = i; break; }
}
if (stop < 0) { console.log('block end not found'); process.exit(1); }
console.log('removing lines', start + 1, '-', stop + 1);
while (lines[start - 1] === '') lines.splice(start - 1, 1);   // 去掉多余空行
lines.splice(start, stop - start + 1);

/* 2) 放到 data-dela 之后（viewAccounts 的最后一条绑定） */
const anchor = lines.findIndex((l) => l.includes("$$('[data-dela]')"));
if (anchor < 0) { console.log('anchor missing'); process.exit(1); }

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
];

lines.splice(anchor + 1, 0, ...guide);
writeFileSync(p, lines.join('\n'), 'utf8');
console.log('guide reinserted after data-dela');
