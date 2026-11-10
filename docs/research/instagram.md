# Instagram — 官方 API 能力 / 审核 / 限流 / 自动化风控 研究笔记

采集日期：2026-10-25。来源均为 Meta for Developers 官方文档。当前 Instagram Platform 产品线为「Instagram API with Instagram Login」（graph.instagram.com）与「Instagram API with Facebook Login」（graph.facebook.com）两套，另有新的「Instagram API with Unified Login」。无法确认的字段标注「未证实」。API 版本 v26.0。

## 1. 官方 API 能力

### 发帖 ✅（仅专业账户）
- **Content Publishing（容器法）**：
  - 创建容器：`POST /{IG_USER_ID}/media`（`image_url` 或 `video_url` + `caption` + `media_type=IMAGE|REELS|VIDEO`…）
  - 发布：`POST /{IG_USER_ID}/media_publish`（`creation_id`）
  - 仅 **Instagram 专业账户（business/creator）** 可用；`image_url` 须为公开可下载 URL。
  - 权限：`instagram_content_publish`（需 **Advanced Access** 服务于非自有账户）。
  - 容器状态轮询 `GET /{IG_CONTAINER_ID}?fields=status_code`：EXPIRED（**24 小时未发布过期**）/ERROR/FINISHED/IN_PROGRESS/PUBLISHED；官方建议每分钟查一次、最多 5 分钟。
  - 合作广告标签：`branded_content_sponsor_ids`（最多 2 个）、`is_paid_partnership`。
- 来源：https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing

### 读评论 ✅ / 回评论 ✅ / 隐藏、删·除 ✅
- **Comment Moderation**（官方指南，更新 2026-10-20）：
  - 读评论：`GET /<IG_MEDIA_ID>/comments`（或广告场景 `/ordered_comments`）
  - 回复：`POST /<IG_COMMENT_ID>/replies`（`message`）
  - 隐藏/取消隐藏：`POST /<IG_COMMENT_ID>`（hide）
  - 删·除：对 `/<IG_COMMENT_ID>` 的删·除操作；禁用评论：`POST /<IG_MEDIA_ID>`（comment_enabled）
  - 权限：`instagram_business_manage_comments`（Business Login）/ `instagram_manage_comments`（Instagram Login 体系，另需 `instagram_business_basic` 等）；发私密回复另需 `instagram_manage_messages`。
  - Webhooks：`comments`、`live_comments`；**官方明确建议用 webhooks 拿评论，以防触发限流**（"We strongly recommend using webhooks to prevent rate limiting."）。
- 来源：https://developers.facebook.com/docs/instagram-platform/comment-moderation

### 读/发私信 ✅（仅用户先发消息后可回复）
- **Instagram Messaging API（Send Messages）**（更新 2026-09-28）：
  - 发送：`POST /<IG_ID>/messages`（`graph.instagram.com`），参数 `recipient:{id:<IGSID>}` + `message:{text|attachments…}`；支持文本/链接/图片(≤8MB)/音视频(≤25MB)/PDF/表情/sticker/模板/回复（reply_to）/回应（react）。
  - **核心限制（官方原文）**："Only after an Instagram user has sent your app user's Instagram professional account a message can your app send a message to the Instagram user. Your app has the duration of the applicable **standard messaging window** to send a message. … For most user actions, it lasts **24 hours**. When the user action is a person sending their first message after clicking a Click-to-Direct ad, the window may last up to **7 days**."；人工客服另有单独 **7 天 Human Agent 窗口**。
  - 不支持群聊（一个专业账户对一个用户）；Requests 文件夹中 30 天无活动的会话不返回；仅专业账户。
  - 权限：`instagram_business_basic` + `instagram_business_manage_messages`；Webhooks：`messages`、`messaging_seen`、`messaging_reactions` 等。
  - 读会话：**Conversations API**（Instagram API with Instagram Login 下）。
- 来源：https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api ；https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api

### 读指标 ✅
- **Insights**：
  - 用户级：`GET /<IG_USER_ID>/insights?metric=…`（如 reach、impressions、accounts_engaged、follower_count、profile_views…）
  - 媒体级：`GET /<IG_MEDIA_ID>/insights?metric=…`（如 reach、impressions、saved、likes、comments、shares…，示例响应含 period=lifetime/day）
  - 权限：`instagram_manage_insights`（本批抓取页面正文被折叠，权限名与 Standard/Advanced 要求未逐字捕获 → 以官方 insights 页为准）；服务非自有账户需 Advanced Access。
- 来源：https://developers.facebook.com/docs/instagram-platform/insights

## 2. 审核要求与门槛
- **Access Level（官方反复出现的门槛）**：
  - **Standard Access**：app 服务你自己拥有/管理、且已在 App Dashboard 添加的专业账户；
  - **Advanced Access**：app 服务**你不拥有/管理的**专业账户时必需（涉及 `instagram_content_publish`、`instagram_manage_messages`、`instagram_manage_comments` 等）。
- App Review 流程与 Meta 通用（见 facebook-page.md 第 2 节）；Instagram 消息类权限要求 app 由**已验证企业**拥有（conversations 端点权限表原文）。
- 来源：https://developers.facebook.com/docs/instagram-platform/comment-moderation ；https://developers.facebook.com/docs/graph-api/reference/page/conversations/ ；https://developers.facebook.com/docs/app-review/

## 3. 限流数值
- **发帖配额**：`GET /<IG_USER_ID>/content_publishing_limit` 端点返回当前配额使用情况；官方示例响应：
  ```json
  { "data": [ { "quota_usage": 2, "config": { "quota_total": 50, "quota_duration": 86400 } } ] }
  ```
  → 示例显示 **quota_total=50、quota_duration=86400 秒 = 每 24 小时 50 条**（具体配额可能按账户/版本而异，以该端点实时查询为准）。
- **评论接口**：官方无公开数值，仅提示高频拉评论会被限流、建议 webhooks → 具体数值未证实。
- **Instagram Platform 常规限流**：Graph API 限流文档说明 Instagram Platform 请求走 **BUC Rate Limits**，错误码 80002；**BUC 具体数值未公开** → 未证实（历史上流传的「200 次/小时/用户」未在本批官方文档中得到确认 → 未证实）。
- **Messaging 限流**（Messenger Platform Rate Limits 页，官方原文）：
  - 文本/链接/表情/sticker：**300 次/秒**/IG 专业账户；音视频：**10 次/秒**；
  - Private Replies：Live 评论 **100 次/秒**；帖文/Reels 评论 **750 次/小时**；
  - 高流量：IG 专业账户收+发累计 **>72,000 条消息** → 收件箱停止显示/发送（横幅 "Your Message May Be Delayed"）。
- 来源：https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit ；https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting ；https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控依据
- **Instagram 使用条款**（help.instagram.com/581066165581870）：本批抓取（直连 + web.archive.org 2026-01 快照 + facebook help 镜像）均只返回 JS 壳（"Help Center"），**条款正文未捕获** → Instagram ToU 自动化禁令条款原文 = **未证实**（需真人登录后抓取或其它镜像）。
- 可用的官方间接依据：
  - Meta 服务条款（2025-01-01）§3.2 明确自动化访问禁令但**适用范围不含 Instagram**（"您对 Instagram 的使用行为须遵守 Instagram 使用条款"）；Facebook/Messenger 的禁令原文见 facebook-page.md 第 4 节。
  - Meta Developer Policies（2026-02-03）§6 Instagram Platform："Don't use the Instagram Platform to simply display User Content, import or backup content, or manage Instagram relationships, without our prior permission."
  - Instagram Messaging API 产品本身限制（用户先发消息、24h 窗口）使自动化营销受限；Developer Policies §5 禁止 bot 式高频消息（spam）。
- 风险等级：**高（推断）** —— Meta 系对自动化访问的禁止条款一致（IG 独立条款普遍包含同类禁令，但原文未抓到故标 inferred/未证实）；具体风控检测与封号阈值官方不公开 → 未证实。
- 来源：https://developers.facebook.com/devpolicy/ ；https://developers.facebook.com/terms/dfc_platform_terms/ ；https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api

## 5. 关键缺口（未证实项汇总）
1. Instagram 使用条款自动化禁令原文：页面 JS 渲染无法抓取 → 未证实。
2. Instagram Platform BUC 限流具体数值：官方未公开 → 未证实。
3. 评论接口限流数值：官方未公开 → 未证实。
4. Insights 权限名与 Standard/Advanced 门槛细节：本批正文折叠未逐字捕获 → 需补抓。
5. 封号阈值/风控算法细节：官方不公开 → 未证实。
