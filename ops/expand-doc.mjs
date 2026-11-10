import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/docs/09-项目链路.html';
let h = readFileSync(p, 'utf8');

const extra = `
<h2>三、采集：抓什么、用什么抓、失败怎么办</h2>
<div class="panel">
<table>
<thead><tr><th style="width:120px">来源</th><th>抓到的字段</th><th>用什么抓</th><th style="width:150px">数量/频率</th><th style="width:150px">失败处理</th></tr></thead>
<tbody>
<tr><td>YouTube</td><td>标题、播放量、时长、发布时间、缩略图、链接</td><td>搜索结果页 HTML（<code>sp=EgQIBRAB</code> 只取今年），yt-dlp 兜底</td><td>每词 20 条，6 个种子词</td><td>单源失败写进 <code>errors[]</code>，不中断其他源</td></tr>
<tr><td>Google News</td><td>标题、来源媒体、时间、链接</td><td>Google News RSS <code>/rss/search?q=</code></td><td>每词 8 条</td><td>同上</td></tr>
<tr><td>Bluesky</td><td>正文、作者、赞/转/回、配图</td><td><code>api.bsky.app/xrpc/app.bsky.feed.searchPosts?sort=top</code></td><td>7 组查询 ×12</td><td>同上</td></tr>
<tr><td>Mastodon</td><td>正文、作者、赞/转/回、配图</td><td><code>{实例}/api/v1/timelines/tag/{tag}</code></td><td>12 个标签 ×20</td><td>同上</td></tr>
<tr><td>Lemmy</td><td>帖文、社区、顶/评论</td><td><code>lemmy.world/api/v3/search</code></td><td>每次刷新</td><td>这条赛道经常为空，据实显示</td></tr>
<tr><td>Amazon</td><td>标题、价格、评分、评价数、月销、主图、<code>/dp/ASIN</code> 链接</td><td><strong>Playwright + 本机 Edge 持久化 profile</strong>，解析 <code>div[data-component-type="s-search-result"]</code></td><td>2 个词 ×8</td><td>遇人机验证 → 记录错误，界面可一键换一批</td></tr>
<tr><td>Alibaba 国际站</td><td>标题、价格、MOQ、主图</td><td>同上，打开 <code>showroom/{keyword}.html</code></td><td>2 个词 ×8</td><td>滑块验证 → 提示「阿里过人机验证」按钮手动过一次</td></tr>
<tr><td>同行站点</td><td>站点标题、描述、建站平台、RSS 更新</td><td>直接 HTTP + 解析</td><td>20 家并发</td><td>失败计入 <code>errors</code>（本轮 20/21 成功）</td></tr>
</tbody>
</table>
<p class="muted" style="margin:10px 0 0">抓完统一进 <strong>kimi 质检</strong>：10 条一批打分（0–100 + keep/drop + 理由），drop 的不展示；硬门槛：视频 ≥5000 播放且 ≤180 天，帖子互动 ≥20，商品按评价/月销排序。</p>
</div>

<h2>四、生图：模型、参数、落盘、怎么发出去</h2>
<div class="panel">
<table>
<thead><tr><th style="width:130px">环节</th><th>具体做法</th></tr></thead>
<tbody>
<tr><td>提示词</td><td>有 <code>content.image_prompt</code> 就用；没有则 <code>chat(task=analyze)</code> 生成 60–90 词英文提示词（产品 + 场景 + 光位 + 留白 + 4:5），顺带产反向词</td></tr>
<tr><td>本地出图</td><td>ComfyUI <code>127.0.0.1:8188</code> + <strong>SD1.5</strong>（<code>v1-5-pruned-emaonly</code>）：KSampler steps 25 / cfg 7 / euler / normal，819×1024，<strong>约 55–70 秒/张</strong></td></tr>
<tr><td>为什么不用 SDXL</td><td>SDXL-turbo 权重 6.6G，这台 6G 显存加载即崩（access violation）；SD1.5 稳定，代价是产品细节偏「氛围图」</td></tr>
<tr><td>外部出图</td><td>设置里填 <code>image_api_base/key/model</code> → <code>POST {base}/images/generations</code>（OpenAI 兼容，<code>response_format=b64_json</code>）；配了外部就优先走外部</td></tr>
<tr><td>落盘</td><td><code>data/media/gen-*.png</code>（本地）或 <code>api-*.png</code>（外部）；DB 写 <code>content.image_path / image_alt / image_prompt</code></td></tr>
<tr><td>发布时</td><td>Bluesky：<code>uploadBlob</code> 上传 → 卡片 <code>thumb</code>；Telegram：<code>sendPhoto</code> 带 caption</td></tr>
<tr><td>批量</td><td><code>POST /api/images/batch {limit:10}</code> 后台串行跑，UI 每 4 秒轮询 <code>GET /api/images/batch</code> 显示 进度/成功/失败</td></tr>
</tbody>
</table>
</div>

<h2>五、数据怎么跟踪</h2>
<div class="panel">
<table>
<thead><tr><th style="width:140px">层</th><th>字段 / 端点</th><th>说明</th></tr></thead>
<tbody>
<tr><td>发布结果</td><td><code>publish_result</code>: ok、channel、platform_post_id、url、error_class、detail</td><td>成功才有 URL；失败归因（pending_config / upstream_error / auth_failed）</td></tr>
<tr><td>指标表</td><td><code>metric</code>: content_id, platform, day, impressions, likes, comments, shares, saves, clicks, sessions, orders_amount, <strong>inquiries</strong>, source</td><td>source = demo / manual / ga4</td></tr>
<tr><td>录入</td><td><code>POST /api/metrics</code></td><td>数据看板有表单，按天回填</td></tr>
<tr><td>聚合</td><td><code>GET /api/metrics/overview?days=30</code></td><td>总量 / 按平台 / 帖子排行（含询盘）/ 互动率 / CTR</td></tr>
<tr><td>归因</td><td>UTM：<code>utm_source=平台&amp;utm_medium=social&amp;utm_campaign=产品slug-YYMM&amp;utm_content=c{id}</code></td><td>与 <code>content.id</code> 一一对应，能倒查是哪条稿带来的</td></tr>
<tr><td>现状缺口</td><td>指标目前<strong>靠手填</strong>；平台侧点赞/曝光没有自动拉回</td><td>GA4 未授权；下一步可加「定时回捞 Bluesky/IG 互动数」</td></tr>
</tbody>
</table>
</div>
`;

h = h.replace('<h2>四、数据表（SQLite · data/workbench.db）</h2>', extra + '\n<h2>六、数据表（SQLite · data/workbench.db）</h2>');
h = h.replace('<h2>五、常驻进程与文件</h2>', '<h2>七、常驻进程与文件</h2>');
writeFileSync(p, h, 'utf8');
console.log('doc expanded');
