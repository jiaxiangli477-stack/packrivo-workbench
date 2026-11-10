import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/web/app.js';
let c = readFileSync(p, 'utf8');

/* 1) 平台授权入口表 */
if (!c.includes('const PLATFORM_AUTH')) {
  c = c.replace(
    'function accountUrl(a) {',
    `const PLATFORM_AUTH = {
  facebook_page: { url: 'https://developers.facebook.com/apps/', need: 'App ID / Secret + 主页访问令牌（Pages API）', note: '建 App → 加 Pages 权限 → 用 Graph API Explorer 取页面令牌（长期令牌建议走系统用户）' },
  instagram: { url: 'https://developers.facebook.com/apps/', need: 'IG 专业账号 + 关联 FB 主页 + 访问令牌', note: 'IG 必须挂在 FB 主页下；用 Content Publishing API 发图' },
  tiktok: { url: 'https://developers.tiktok.com/apps', need: 'Client Key / Secret + 授权（Content Posting API）', note: '建 App → 申请 content.post 权限 → 走 OAuth 拿 access_token' },
  pinterest: { url: 'https://developers.pinterest.com/apps/', need: 'App ID / Secret + 授权（Pins API）', note: '建 App → 申请 pins:write → OAuth 拿 refresh token' },
  x: { url: 'https://developer.x.com/en/portal/dashboard', need: 'API Key / Secret + Access Token', note: '免费档只能发文本；发图要 Basic 以上' },
  linkedin: { url: 'https://www.linkedin.com/developers/apps', need: 'Client ID / Secret + 组织页授权', note: '要公司主页管理员身份才能发到 Page' },
  youtube: { url: 'https://console.cloud.google.com/apis/credentials', need: 'OAuth 客户端 + YouTube Data API 权限', note: '上传视频需要未验证配额 1600 点/天' },
  reddit: { url: 'https://www.reddit.com/prefs/apps', need: 'client_id / secret + refresh token', note: '脚本型 App，注意 subreddit 规则' },
  threads: { url: 'https://developers.facebook.com/apps/', need: 'Threads API 权限', note: '和 IG 同一个 Meta App，加 Threads 产品' },
  mastodon: { url: 'https://mastodon.social/settings/applications', need: '实例应用 + access token（write 权限）', note: '换成你自己的实例域名再打开这个路径' },
  bluesky: { url: 'https://bsky.app/settings/app-passwords', need: 'App Password', note: '不是登录密码；生成一次就复制' },
  telegram: { url: 'https://t.me/BotFather', need: 'Bot Token + 频道 chat_id', note: '建 bot → 拉进频道设为管理员 → 频道 @username 或 -100xxx' },
  pinterest_ads: { url: 'https://ads.pinterest.com/', need: '广告账号（可选）', note: '' },
};

function accountUrl(a) {`
  );
}

/* 2) 账号表格加「去绑定」 */
c = c.replace(
  '<td><a class="btn ghost tiny" href="${esc(accountUrl(a))}" target="_blank" rel="noreferrer">打开主页</a>',
  '<td><a class="btn ghost tiny" href="${esc(accountUrl(a))}" target="_blank" rel="noreferrer">打开主页</a>${PLATFORM_AUTH[a.platform] ? `<a class="btn ghost tiny" href="${PLATFORM_AUTH[a.platform].url}" target="_blank" rel="noreferrer">去绑定</a>` : ""}'
);

/* 3) 账号页底部：各平台授权入口卡片 */
c = c.replace(
  "  };\n  $$('[data-cred]').forEach((b) => {",
  `  };

  $('#view').insertAdjacentHTML('beforeend', \`
    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>各平台绑定入口</h2><span class="hint">点「打开授权页」到平台官方页面拿凭据，回来点「填凭据」粘贴</span></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
        \${Object.entries(PLATFORM_AUTH).filter(([k]) => k !== 'pinterest_ads').map(([k, v]) => \`
          <div class="panel" style="background:var(--surface-2);padding:12px">
            <div class="row" style="justify-content:space-between;align-items:center">
              <strong>\${esc(pname(k) || k)}</strong>
              <a class="btn tiny" href="\${v.url}" target="_blank" rel="noreferrer">打开授权页</a>
            </div>
            <div class="muted" style="font-size:12.5px;margin-top:6px">需要：\${esc(v.need)}</div>
            \${v.note ? \`<div class="muted" style="font-size:12px;margin-top:4px">\${esc(v.note)}</div>\` : ''}
          </div>\`).join('')}
      </div>
    </div>\`);
  $$('[data-cred]').forEach((b) => {`
);

writeFileSync(p, c, 'utf8');
console.log('account binding guides added');
