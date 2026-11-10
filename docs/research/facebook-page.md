# Facebook Page — 官方 API 能力 / 审核 / 限流 / 自动化风控 研究笔记

采集日期：2026-10-25。来源均为 Meta for Developers 官方文档（developers.facebook.com）与 Meta 服务条款原文。无法确认的字段标注「未证实」。当前 Graph API 版本 v26.0。

## 1. 官方 API 能力

### 发帖 ✅
- **Pages API / Page Feed**：`POST /{page-id}/feed`（参数 message / link / published / scheduled_publish_time / targeting.geo_locations）；图片 `POST /{page-id}/photos`；视频走 Video API。
  - 定时发布：发布时间须在请求时刻之后 **10 分钟 ~ 30 天** 之间。
  - 需要的权限（Facebook Login 获取 Page access token）：`pages_manage_engagement`、`pages_manage_posts`、`pages_read_engagement`、`pages_read_user_engagement`（发视频再加 `publish_video`）。
  - app 用户须能对该 Page 执行 `CREATE_CONTENT`、`MANAGE`、`MODERATE` 任务；若 app 用户不拥有/管理目标 Page，需 User access token + **Page Public Content Access** 特性。
- 来源：https://developers.facebook.com/docs/pages-api/posts/ （更新 2026-04-17）

### 读评论 ✅
- **Object Comments**：`GET /{object-id}/comments`（Page Post / Photo / Video / Album / Comment 等对象通用）；参数 `filter=toplevel|stream`、`summary=1`（返回 total_count、order）。
  - 读取权限要求：与查看父对象相同的权限。用 User access token 读 Album/Photo/Post/Video 的评论返回空。
  - 使用 Page Public Content Access 的应用不再返回 `/PAGEPOST-ID/comments` 的 `id` 字段（v11+ 生效）；要拿到评论 id 需对目标 Page 有 `MODERATE` 任务。
- 来源：https://developers.facebook.com/docs/graph-api/reference/object/comments/ （v26.0）

### 发评论/回复 ✅
- `POST /{object-id}/comments`（message / attachment_id / attachment_url / source）；回复用同一端点（comment 对象的 /comments 边）。
  - 要求：Page access token + 用户对 Page 有 `MODERATE` 任务 + `pages_manage_engagement` 权限；可在 message 中用 `@[page-id]` @提及（需过审）。
  - 单条评论的删·除走 `/comment-id` 端点（`/comments` 边本身不支持删·除操作）。
- 来源：https://developers.facebook.com/docs/graph-api/reference/object/comments/

### 读/发私信 ✅（Page 与用户之间的会话）
- **Page Conversations**：`GET /{page-id}/conversations`（参数 folder / platform=MESSENGER|INSTAGRAM / user_id），返回 UnifiedThread 列表。
  - Messenger 会话权限：Page access token（用户有 `MESSAGING` 任务）+ `pages_manage_metadata`、`pages_read_engagement`、`pages_messaging`。
  - Instagram 会话：另需 `instagram_basic`、`instagram_manage_messages`，且 app 必须由**已验证企业**拥有。
- **发送消息 = Messenger Platform Send API**：`POST /me/messages`（recipient + message），需 `pages_messaging` 权限、Page 有 `MESSAGING`/`MODERATE` 任务；受 **24 小时标准消息窗口** 约束（仅用户先发消息后才能回复；Business Messaging 文档体系的 messaging windows 策略，未在本批逐字抓取窗口定义原文 → 窗口细节以官方 send-messages 文档为准）。
- 来源：https://developers.facebook.com/docs/graph-api/reference/page/conversations/ （v26.0）；https://developers.facebook.com/docs/messenger-platform/overview

### 读指标 ✅
- **Page Insights**：`GET /{page-id}/insights?metric=…`（单指标或逗号分隔多指标），也可 `/{page-id}/insights/{metric}`；返回 InsightsResult。
  - 权限/任务：Page access token + 用户对 Page 有 `ANALYZE` 任务 + `read_insights`、`pages_read_engagement` 权限。
  - 限制（官方原文要点）：
    - 仅 **100 赞以上** 的 Page 有 Insights 数据；
    - 大多数指标 **每 24 小时** 更新一次；
    - 仅提供**最近 2 年**数据；`since`/`until` 一次最多查 **90 天**；
    - 人口统计类指标（年龄/性别/地区）仅当样本 ≥100 人时返回。
  - 指标族：page_impressions_*、page_engaged_users、page_post_engagements、page_fans、page_video_views_*、post_impressions_*、page_total_actions、page_views_total 等（day/week/days_28/lifetime 周期）。注意：2026-06-15 起部分 Page Insights 指标在所有版本废弃。
- 来源：https://developers.facebook.com/docs/graph-api/reference/page/insights/ （v26.0）

## 2. App 审核与门槛
- **App Review**：若 app 面向任何**没有 app Role、也不是已认领该 app 的 Business 成员**的用户使用，**必须先过 App Review**；只给拥有 app Role 的用户使用则无需审核。
  - 未过审的权限只能向有 app Role 的用户请求；已过审权限可向所有用户请求。审核会实际测试 app，无法访问测试即整单拒绝。
  - 关联流程：**Business Verification**（单独流程）；权限另有 Standard/Advanced Access 层级。
- 门槛要点（对 FB Page 发帖/评论/私信/指标路径）：Page 数据/发帖类权限需 Page access token + 对应 Page 任务；服务非自有 Page 需 Page Public Content Access 特性（受限特性）；Instagram 私信要求已验证企业。
- 来源：https://developers.facebook.com/docs/app-review/ （更新 2024-04-10）；https://developers.facebook.com/terms/dfc_platform_terms/ （2026-02-03 更新）

## 3. 限流数值
- **Graph API 平台级限流**（Rate Limits 页，官方原文）：
  - 应用（app access token）：**滚动 1 小时窗口**，`Calls within one hour = 200 * Number of Users`（Number of Users 取 app 的日活/周活/月活用户数）→ 有 100 用户的 app ≈ 2 万次/小时。
  - 用户（user access token）：滚动 1 小时窗口，**出于隐私官方不公布用户级具体数值**（"Due to privacy concerns, we do not reveal actual call count values for users."）。
  - 响应头 `X-App-Usage`（call_count/total_cputime/total_time 百分比）；超限错误码：4（app）、17（user）、**32（Page）、80001（Page/System User token 的 BUC 限流）**、613 等。
  - **Pages API**：用 app/user token → Platform 限流；用 Page token / system user token → **Business Use Case (BUC) 限流**；BUC 具体数值**未公开**（错误码 80001/80006(Messenger)/80002(Instagram)）。
- **Messenger Platform 限流**（Rate Limits 页，官方原文）：
  - Instagram Messaging：每 IG 专业账户 **300 次/秒**（文本/链接/表情/sticker）；**10 次/秒**（音视频内容）。
  - Private Replies API：IG Live 评论私密回复 **100 次/秒**；帖文/Reels 评论私密回复 **750 次/小时**。
  - 高流量保护：Messenger Page **>40 条消息/秒** 持续发送/并发大量会话 → 收件箱停止显示/发送新消息；Instagram 专业账户累计收/发 **>72,000 条消息** → 触发限流横幅（"Your Message May Be Delayed"）。
  - Messenger Send API 的每秒调用数值位于该页「Messenger」小节（本批抓取时该小节正文被页面折叠省略，未捕获具体数字 → 未证实）。
- 来源：https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ ；https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview/rate-limiting

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控依据
**依据 = Meta 服务条款（2025-01-01 生效，官方 plain-text 版，本次抓到中文渲染）§3.2 原文**：
- "未经我们事先允许，您不得使用自动化方式访问或收集我们产品的数据，也不得试图访问您无权访问的数据，无论在自动化访问或收集数据时是否登录了 Facebook 账户。"（英文原文对应 "You may not access or collect data from our Products using automated means (without our prior permission) or attempt to access data you do not have permission to access." —— 英文句为条款通行版本，本次仅抓取到中文渲染，英文原文未逐字复核 → 中文引用为已观察，英文以官方英文页为准）
- "对于 Meta 用于控制或限制我们产品或数据的访问权限的任何技术措施，您不得采取或试图采取任何行动来规避、绕过或改写。"
- §3.1："不得将自己的账户密码透露给他人，不得允许他人使用自己的 Facebook 账户"；§4.2：违反条款可冻结/停用账户。
- 注意：本条款明示适用范围为 Facebook、Messenger 等 Meta 产品；**Instagram 适用独立的《Instagram 使用条款》**。
- 开发者政策侧（Developer Policies，2026-02-03）：§5 明确「以极高频率手动或自动创建 bot」属 spam 禁止行为；§6 Instagram Platform："Don't use the Instagram Platform to simply display User Content, import or backup content, or manage Instagram relationships, without our prior permission."
- 风险等级：**高**（消费者条款明令禁止自动化访问与绕过风控措施，违规可冻结/停用账户；具体风控检测手段与封号阈值官方不公开 → 未证实）。
- 来源：https://www.facebook.com/legal/terms/plain_text_terms ；https://developers.facebook.com/devpolicy/

## 5. 关键缺口（未证实项汇总）
1. BUC（Page token）限流的具体数值：官方未公开 → 未证实。
2. 用户级 Platform 限流数值：官方出于隐私不公开 → 未证实。
3. Messenger Send API 每秒调用数：本批未捕获到原文数值 → 未证实（页面有该小节）。
4. 24 小时消息窗口的逐条原文定义：本批只抓到概述引用 → 细节需再抓 send-messages 文档。
5. 封号阈值/风控算法细节：官方不公开 → 未证实。
