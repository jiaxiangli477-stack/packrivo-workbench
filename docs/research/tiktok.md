# TikTok — 官方 API 能力 / 审核 / 限流 / 自动化风控 研究笔记

采集日期：2026-10-25。来源均为 TikTok for Developers 官方文档（developers.tiktok.com）。无法确认的字段标注「未证实」。

## 0. 产品线全景（官方站导航，2026-10）
消费者侧产品：Share Kit、Login Kit、**Content Posting API**、**Display API**（Content Display）、Embed Videos、**Data Portability API**、Green Screen Kit、**Commercial Content API**、**Research API**。**导航中没有「评论 API」「DM API」「Insights API」**——消费者侧读评论/实时私信/视频指标的能力在官方产品目录中不存在（详见第 1 节）。

## 1. 官方 API 能力

### 发帖 ✅（视频/图文直接发布到用户账号）
- **Content Posting API — Direct Post**（Get Started 更新 2026-08-04）：
  - 流程：`POST /v2/post/publish/creator_info/query/`（查创作者信息：privacy_level 选项、comment_disabled、`max_video_post_duration_sec`（示例值 300））→ `POST /v2/post/publish/video/init/`（初始化，source=FILE_UPLOAD 或 PULL_FROM_URL）→ 分块 `PUT` 上传 → 发布。
  - 前置条件（官方原文要点）：app 注册并添加 Content Posting API 产品；启用 Direct Post 配置；**app 获批 `video.publish` scope**；目标用户授权 `video.publish` scope；PULL_FROM_URL 需**验证域名/URL 前缀**。
  - 视频格式：MP4+H.264 等；caption（title）最长 **2200 个 UTF-16 字符**。
  - **审计要求（官方原文）**："All content posted by unaudited clients will be restricted to private viewing mode. Once you have successfully tested your integration, to lift the restrictions on content visibility, your API client must undergo an audit to verify compliance with our Terms of Service."
  - 草稿模式：`video.upload` scope（Share Video API / Upload），内容以草稿进创作者账号待其手动发布。
  - 图文帖：新增 Photo Post（`/v2/post/publish/photo_post/init/`，media_type=PHOTO）。
- 来源：https://developers.tiktok.com/doc/content-posting-api-get-started ；https://developers.tiktok.com/doc/content-posting-api-reference-direct-post

### 读评论 ❌（消费者侧无此 API）
- Scopes Reference（2026-08-19 更新）全量 scope 列表：user.info.basic / user.info.profile / user.info.stats / video.list / video.publish / video.upload / portability.* / research.* / research_adlib.* / local.*（本地生活）——**没有任何评论读写 scope**。
- 结论：官方消费者 API **不提供读评论能力**（TikTok Shop 卖家侧有商品评论类 API，属另一套平台，本批未验证 → 未证实）。
- 来源：https://developers.tiktok.com/docs/en/tiktok-api-scopes

### 读/发私信 ❌（无实时 DM API；仅有数据导出）
- 开发者站产品导航无 DM API；scope 列表中与私信相关的仅有 **Data Portability API**：
  - `portability.directmessages.single`："Make a single request for direct message data on the user's behalf — Export a copy of your direct message data"
  - `portability.directmessages.ongoing`：持续导出 DM 数据副本。
  - 即：**只能一次性/持续导出私信副本（数据可携带性用途），不能实时读发私信**。
- TikTok Shop 卖家侧的 DM API（partner.tiktokshop.com）需要卖家合作伙伴账号，本批未验证 → 未证实。
- 来源：https://developers.tiktok.com/docs/en/tiktok-api-scopes ；https://developers.tiktok.com/products/data-portability-api

### 读指标 ⚠️ 部分
- `user.info.stats` scope："Read access to a user's statistical data, such as likes count, follower count, following count, and video count" → 仅授权用户**自身主页统计**（粉丝数/获赞/关注/视频数）。
- `video.list`（Display API）：`POST /v2/video/list/`（max_count ≤20）拉授权用户的公开视频列表（含 id/title/cover/embed_link），**不含播放量等视频级指标**。
- 视频级/内容级指标：消费者 API **无公开 scope**；聚合研究数据走 **Research API**（research.data.basic 等，仅限获批准的研究用途）；广告侧指标在 TikTok for Business Marketing API（business-api.tiktok.com，广告主体系，本批未验证 → 未证实）。
- 来源：https://developers.tiktok.com/docs/en/tiktok-api-scopes ；https://developers.tiktok.com/docs/en/display-api-get-started

## 2. 审核要求与门槛
- 所有 API 需注册 app + 添加产品 + **scope 审批**（app 页 Scopes 管理；获批 scope 后仍须用户逐项授权）。
- Content Posting API：`video.publish` scope 审批 + **客户端审计（audit）**，未审计→内容仅自己可见。
- Commercial Content API（广告透明度库）：在线申请表单，**约 2 个工作日出结果**；当前仅 EU 广告数据，面向研究者/公众。
- Research API：研究用途申请（research.* scope，VRA 面向 vetted researchers）。
- 来源：https://developers.tiktok.com/doc/scopes-overview ；https://developers.tiktok.com/doc/content-posting-api-get-started ；https://developers.tiktok.com/products/commercial-content-api

## 3. 限流数值
- **Direct Post 初始化端点（官方原文）**："**Note**: Each user access_token is limited to **6 requests per minute**."（POST /v2/post/publish/video/init/）
- 其他接口（video.list、user.info、post status 等）公开文档未给出每秒/每天数值 → 未证实。
- 开发者条款 III.3(g) 定性约束："exceeds reasonable request volume, constitutes excessive or abusive usage" → 可被暂停/终止（具体阈值未公开）。
- 来源：https://developers.tiktok.com/doc/content-posting-api-reference-direct-post ；https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控依据
**依据 = TikTok Developer Terms of Service（2025-12-26 修订）**（其适用范围含 "TikTok Services"——TikTok.com 与 TikTok 移动应用；以下禁令条款原文）：
- III.3(k)：不得 "use any robot, spider, site search or retrieval application, or other device to collect information about users of the TikTok Developer Services for any unauthorized purposes or in a manner that could affect system performance or compromise user or advertiser data"；
- III.3(m)：不得 "interfere with or attempt to interfere with the proper working of the TikTok Developer Services or TikTok Services … or bypass, circumvent or attempt to bypass or circumvent any measures we may use to prevent or restrict access to the TikTok Developer Services or TikTok Services"；
- III.3(g)：不得 "exceeds reasonable request volume, constitutes excessive or abusive usage"；
- VI：TikTok 可随时无通知暂停或终止服务；III.1：应用需提交审核。
- 消费者版《TikTok Terms of Service》（tiktok.com/legal/page/us/terms-of-service/us/en）为 JS 渲染，本批未抓到正文 → 消费者条款自动化禁令原文 **未证实**。
- 风险等级：**高（inferred）** —— 开发者条款已明文禁止 robot/spider 采集与绕过访问控制（涵盖 TikTok Services）；具体风控检测与封号阈值官方不公开 → 未证实。
- 来源：https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en ；https://developers.tiktok.com/doc/content-posting-api-get-started（审计要求）

## 5. 关键缺口（未证实项汇总）
1. 读评论 / 实时 DM：消费者官方 API 无此能力（scope 列表实证）；TikTok Shop 卖家侧 DM/评论 API 未验证 → 未证实。
2. 视频级指标 API：消费者侧无（Research API 仅研究用途；广告侧 Business API 未验证）→ 未证实。
3. 除 Direct Post 6 次/分钟外的限流数值：官方未公开 → 未证实。
4. 消费者 TikTok ToS 自动化禁令原文：JS 页面未抓到 → 未证实。
5. 封号阈值/风控算法细节：官方不公开 → 未证实。
