# X（Twitter）平台研究笔记

> 调研日期：2026-10-25。来源：官方开发者文档 docs.x.com（本文档全部页面支持 `.md` 后缀取原始 Markdown）、docs.x.com/developer-guidelines（开发者指南）。
> 说明：X 在 2026 年采用 **X API v2 + 按量付费（pay-per-usage）** 模式，旧版 Free/Basic/Pro 分级文档已不适用。

## 1. 官方 API 能力（逐项）

| 能力 | 结论 | 依据 |
|---|---|---|
| 发帖 | ✅ 支持。`POST /2/tweets` 创建帖子；可带回复配置（`reply.in_reply_to_tweet_id`）、媒体、投票、引用帖。媒体：最多 4 张图片 / 1 个 GIF / 1 个视频。**Quote-posting（quote_tweet_id）需要 Enterprise 套餐**，自助（pay-per-use）档位不可用。视频时长上限跟随发帖账号的 X Premium 状态（非 Premium：20 分钟/8GB；Premium/verified：125 分钟/16GB），超限返回 403。 | https://docs.x.com/x-api/posts/creation-of-a-post（原文："Quote-posting (using the `quote_tweet_id` parameter) requires an Enterprise plan. It is not available on self-serve (pay-per-use) tiers."；"Posting account video cap... Default (no Premium) 20 minutes, 8 GB / X Premium / verified 125 minutes, 16 GB"） |
| 读评论（回复） | ✅ 支持（间接）。X 没有独立的"评论"资源，回复就是带 `conversation_id` 的帖子：用 `GET /2/tweets/search/recent?query=conversation_id:<id>` 拉取某帖全部回复；也可用 filtered stream 规则实时监听。另 `PUT /2/tweets/:tweet_id/hidden` 可隐藏回复（管理）。 | https://docs.x.com/x-api/fundamentals/conversation-id（原文："Use `conversation_id` as a search operator to retrieve all posts in a thread"）；限流表中 Hide replies 端点 |
| 读私信 | ✅ 支持。DM Lookup：`GET /2/dm_events`、`/2/dm_events/:id`、`/2/dm_conversations/:id/dm_events`、`/2/dm_conversations/with/:participant_id/dm_events`。 | https://docs.x.com/x-api/direct-messages （"Direct Messages lookup — Retrieve DM events"）；https://docs.x.com/x-api/direct-messages/lookup/introduction |
| 发私信 | ✅ 支持。`POST /2/dm_conversations`（建会话）、`POST /2/dm_conversations/with/:participant_id/messages`、`POST /2/dm_conversations/:id/messages`；支持文本+媒体附件；要求 User Access Token（OAuth 2.0 PKCE）。 | https://docs.x.com/x-api/direct-messages （Manage Direct Messages；"Prerequisites - An approved developer account - A Project and App ... User Access Tokens via OAuth 2.0 PKCE"） |
| 读指标 | ✅ 支持。`tweet.fields=public_metrics` 返回 `impression_count / like_count / reply_count / retweet_count / quote_count / bookmark_count`（Bearer Token 即可）；`non_public_metrics`（url_link_clicks、user_profile_clicks、engagements）、`organic_metrics`、`promoted_metrics` 需 user context 且仅限本人帖子；**非公开/有机/推广指标仅对最近 30 天内创建的帖子可用**；视频播放指标走 media 字段。另有 `GET /2/users/:id/analytics`（Analytics 1 endpoint）与 Posts analytics 端点。 | https://docs.x.com/x-api/fundamentals/metrics（原文："30-day limit: Non-public, organic, and promoted metrics are only available for posts created within the last 30 days."） |

## 2. 审核 / 准入要求

- 开发者账号：登录 console.x.com 注册 → 接受 **Developer Agreement and Policy** → 填写用途说明 → 创建 Project/App 拿凭据。文档未描述人工审批环节（注册即用）。
- 商业模式：**按量付费（credit-based，先购 credits 按请求扣费）**；Pay-per-usage 套餐有 **月上限 300 万 Post reads**，更高需 Enterprise 套餐（联系销售）。同一条帖 24 小时内重复获取只计费一次（dedup）。
- 部分能力有档位门槛：Quote-posting、更高额限流需 Enterprise；DM 要求 OAuth 2.0 user token。
- 来源：https://docs.x.com/x-api/getting-started/getting-access 、https://docs.x.com/x-api/fundamentals/post-cap

## 3. 限流数值（窗口+适用条件，均来自官方限流表）

来源：https://docs.x.com/x-api/fundamentals/rate-limits（"Limits are shown per 15 minutes unless otherwise noted"）
- **发帖 `POST /2/tweets`：per app 10,000/24hrs；per user 100/15min**
- 删帖 `DELETE /2/tweets/:id`：per user 50/15min
- 隐藏回复 `PUT /2/tweets/:tweet_id/hidden`：per user 50/15min
- 发私信（3 个 POST 端点）：per app 1,440/24hrs；per user 15/15min + 1,440/24hrs
- 读私信（4 个 GET 端点）：per user 15/15min
- 删 DM 事件 `DELETE /2/dm_events/:id`：per app 4,000/24hrs；per user 300/15min + 1,500/24hrs
- 帖子查询 `GET /2/tweets`：per app 3,500/15min；per user 5,000/15min
- 近期搜索 `GET /2/tweets/search/recent`：per app 450/15min；per user 300/15min
- 全量搜索 `/2/tweets/search/all`：per app 1/sec + 300/15min；per user 1/sec
- 点赞 `POST /2/users/:id/likes`：per user 50/15min + 1,000/24hrs
- 用户时间线 `GET /2/users/:id/tweets`：per app 10,000/15min；per user 900/15min
- Enterprise 客户限流为定制（联系客户经理）。
- 响应头 `x-rate-limit-limit / remaining / reset` 返回余量；超限 429。

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控

- **官方明令禁止并给出"永久封禁"表述**（来源：https://docs.x.com/developer-guidelines ，Developer Guidelines & Policies）：
  - "**Non-API automation (scraping, browser automation) results in permanent suspension. Always use the official X API.**"
  - 表格原文："App scrapes X via browser automation (not API) | **Permanent suspension**—API only"
  - "No scraping, browser automation, or unofficial methods. Violations result in permanent suspension."
- 自动化账号（bot）须开启 'Automated' 标签、披露运营者；AI 生成回复需事先经 X 批准。
- 结论：**风险极高（官方条款明示永久封禁）**。具体封号率/检测机制数值官方未公开 → **未证实**。
- 注：help.x.com 的 x-automation 页面经 Cloudflare 拦截（403 "Just a moment..."），未取得该页原文；以上证据来自 docs.x.com 官方开发者指南。

## 5. 证据文件路径（本机留存）

- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\x-rate-limits.md`（限流表全文）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\x-metrics.md`（指标全文）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\x-about-api.md`、`x-getting-access.md`、`x-post-cap.md`、`x-conv-id.md`
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\x-dev-guidelines.md`（开发者指南全文，含自动化禁令原文）
