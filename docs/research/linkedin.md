# LinkedIn — 官方 API 能力 / 审核 / 限流 / 自动化风控 研究笔记

采集日期：2026-10-25。所有结论来自 LinkedIn 官方开发者文档（learn.microsoft.com/linkedin/）与 LinkedIn 用户协议原文；无法确认的字段已标注「未证实」。

## 1. 官方 API 能力

### 发帖 ✅
- **Posts API**（替代已废弃的 ugcPosts API）：`POST https://api.linkedin.com/rest/posts`
  - 支持内容类型：纯文本 / 图片 / 视频 / 文档 / 文章 / MultiImage（仅自然）/ 投票（仅自然）/ 庆祝（仅自然）；Carousel 仅赞助。
  - 请求头要求 `Linkedin-Version: {YYYYMM}`、`X-Restli-Protocol-Version: 2.0.0`；成功返回 201，`x-restli-id` 含 `urn:li:share:…` 或 `urn:li:ugcPost:…`。
  - 还可：Reshare（`reshareContext.parent`）、定向自然帖（targetEntities，受众须 >300 人，用 Audience Counts API 校验）、Dark Posts（`feedDistribution: NONE` + adContext）。
- 权限：
  - `w_organization_social`：以组织名义发帖/评论/点赞。要求公司主页角色 ADMINISTRATOR / DIRECT_SPONSORED_CONTENT_POSTER / CONTENT_ADMIN。
  - `w_member_social`：以成员名义发帖/评论/点赞（Consumer「Share on LinkedIn」产品即用此权限，**开放权限，自助申请**）。
  - `r_organization_social` / `r_member_social`：读取；其中 `r_member_social` 为 **restricted**，仅对获批开发者。
- 来源：https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api （2026-05-13 更新）

### 读评论 ✅（读写均支持）
- **Comments API**：`GET/POST/PATCH/删·除 https://api.linkedin.com/rest/socialActions/{shareUrn|ugcPostUrn|commentUrn}/comments[/{commentId}]`
  - 支持：获取单条评论、批量获取、获取帖下评论、获取嵌套评论、创建、编辑、删·除；评论支持图片、@提及、嵌套。
- 权限：`w_organization_social_feed`（角色 ADMINISTRATOR / DIRECT_SPONSORED_CONTENT_POSTER / RECRUITING_POSTER）、`r_organization_social_feed`、`w_member_social_feed`、`r_member_social_feed`（**Restricted**，仅限选定开发者）。
- 来源：https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api （2026-04-30 更新）

### 读/发私信 ⚠️ 未证实
- 当前 Community Management 官方文档（2026-05-15）的 Approved Use Cases 仅列出 Page Management、Page Analytics、Member Analytics、Profile Management、Employee Advocacy，**未列出任何 Messaging/私信 API**。
- 历史 Messaging 文档路径（linkedin/marketing/community-management/messaging/messages-api）返回 **404**；官方文档站内搜索「messaging api」「conversations api」均无 LinkedIn 私信 API 页面命中。
- 结论：截至 2026-10-25，LinkedIn **官方 API 读/发私信能力 = 未证实**（历史上有过 w_member_messaging 权限与 Messages API，已不在当前文档体系中）。Compliance 权限 r_compliance/w_compliance 为 Closed，不可申请。
- 来源：https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview ；https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access

### 读指标 ✅
- **Organization Page Statistics**：`GET /rest/organizationPageStatistics?q=organization&organization={urn}`（brand 版：`/rest/brandPageStatistics`）
  - lifetime 统计（不传 timeIntervals）与 time-bound 统计（timeIntervals.timeGranularityType=DAY|MONTH + timeRange start/end，毫秒时间戳）；可按国家/职能/行业/资历/公司规模/移动桌面细分；含 pageViews、clicks（CustomButton）。
  - 权限：`rw_organization_admin`（要求页面角色 ADMINISTRATOR）。
- 其他指标 API（Community Management Overview 列出）：Organization Share Statistics（帖子指标）、Organization/Member Follower Statistics（粉丝）、Member Post Statistics（`memberCreatorPostAnalytics`）、Video Analytics（watch time / views / viewers）、Social Metadata（reactions/comments 社交元数据）。
- 来源：https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/page-statistics （2026-06-24）；https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview

## 2. 审核要求与门槛
- **开放权限（Consumer）**：Sign In with LinkedIn（OIDC profile/email）、Share on LinkedIn（w_member_social）——所有开发者自助启用，无需审批。
- **Marketing API**：须先获批「Advertising API」产品（Developer Portal → Products 添加并申请）；Audiences 权限需先成为获批 Advertising API partner。LinkedIn Marketing Partner 计划入口 business.linkedin.com/marketing-solutions/marketing-partners。
- **Community Management API**：**Vetted Product，分两档**——
  - Development Tier：初批，有限调用量；
  - Standard Tier：需在申请表中提交 screencast 视频，逐 use case 演示（Technical Sign Off）。
  - FAQ：`r_member_social` 为 closed 权限，暂不接受申请。
- 来源：https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access （2026-06-03）；https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview

## 3. 限流数值
- **通用机制**（Rate Limiting 页，2025-08-20 更新）：
  - 原文："Rate limits specify the maximum number of API calls that can be made in a 24 hour period. These limits reset at midnight UTC every day."
  - 两类：Application 级（app 每日总调用量）与 Member 级（单成员每 app 每日调用量）；超限返回 **429**。
  - 原文："**Standard rate limits are not published in documentation.**" —— 具体端点数值只能在 Developer Portal → App → Analytics 页查询（仅显示当天至少调用过 1 次的端点）。
  - app 用量达 **75%** 时给 Developer Admin 发邮件告警（延迟约 1-2 小时）。
- **Community Management API Development Tier**（Overview FAQ 官方原文）：
  - "Default API rate limits for Community Management API Development Tier have been increased: **Per App**: Increased from 100 to **500** requests. **Per Member**: Increased from 10 to **100** requests."
  - 窗口：FAQ 未单独注明，结合限流页「24 小时、UTC 午夜重置」机制理解 → Development Tier ≈ 500 次/app/天、100 次/member/天（窗口措辞以官方两页合并解读，未见单独数值页）。
- **评论创建短时限流**（Comments API 原文错误表）：`429 Comment create throttled: creation rate limit exceeded for member`——"Indicates member has hit the short term 1 minute rate limit for common creation."（具体每分钟条数未公开）。
- Standard Tier 各端点限流数值：未公开 → 未证实。
- 来源：https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits ；https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview ；https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控依据
**依据 = LinkedIn User Agreement（2025-11-03 生效）§8.2「Don'ts」原文**：
- "Develop, support or use software, devices, scripts, robots or any other means or processes (such as crawlers, browser plugins and add-ons or any other technology) to scrape or copy the Services, including profiles and other data from the Services;"
- "Override any security feature or bypass or circumvent any access controls or use limits of the Services (such as search results, profiles, or videos);"
- "Use bots or other unauthorized automated methods to access the Services, add or download contacts, send or redirect messages, create, comment on, like, share, or re-share posts, or otherwise drive inauthentic engagement;"
- 另 §3.4：LinkedIn 有权限制/暂停/终止账号（违规后果）。
- 官方开发者文档侧（Restricted Uses 页，2025-08-29）：**"No Headless or Fake Accounts: Do not create fake profiles to manage ad accounts or use individual profiles to manage multiple customers' accounts."**
- 风险等级：**高**（条款明令禁止 bot/自动化访问、抓取、绕过访问控制，违规可封号/终止 API 访问；具体封号阈值/风控算法官方不公开 → 未证实）。
- 其他重要合规限制（对工作台设计有直接影响）：社区管理 API 数据 **禁止用于社交 feed 展示**（"No Social Feeds"）；成员社交活动数据仅可存 **48 小时**、多数 profile 数据仅可存 **24 小时**；禁止导出成员数据。
- 来源：https://www.linkedin.com/legal/user-agreement ；https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases

## 5. 关键缺口（未证实项汇总）
1. 官方 API 读/发私信能力：当前文档无（404/无导航项）→ 未证实。
2. Standard Tier / 各端点具体限流数值：官方不公开 → 未证实。
3. 封号阈值、风控模型细节、自动化被检测概率：官方不公开 → 未证实。
4. 评论创建 1 分钟限流的每秒/每分钟具体条数：官方只说明存在 1 分钟窗口，未给数值 → 未证实。
