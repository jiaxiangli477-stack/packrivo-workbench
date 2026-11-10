# WhatsApp Business Cloud API — 研究笔记

抓取日期：2026-10-25（注：Meta 开发者文档已迁移至新文档树 /documentation/business-messaging/whatsapp/…）
原始抓取产物：task workdir i28\fetch\ 下 wa_*.html / jina_wa_*.md

## 来源 URL
- 平台总览：https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- 消息限额：https://developers.facebook.com/docs/whatsapp/messaging-limits
- Graph API 平台限流：https://developers.facebook.com/docs/graph-api/overview/rate-limiting
- 指标/Analytics：https://developers.facebook.com/docs/whatsapp/business-management-api/analytics
- Webhooks 入门：https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- 商业政策：https://www.whatsapp.com/legal/business-policy/

## 1. 官方 API 能力
- **发帖**：不适用/无此能力。Cloud API 是 1:1 与群组业务消息通道，无公开 feed、无"发帖/动态"概念。文档消息类型（overview 页导航）为 text/image/video/audio/document/contacts/location/sticker/interactive/reaction/address 等；未发现 Story/Status 发布端点（webhooks 参考中的 "status messages" 指消息**送达状态**）。
- **读评论**：不适用。无公开评论系统。
- **读私信**：有。通过 Webhooks 接收入站消息（text/image/reaction 等类型，见 webhooks reference "messages" 分组）。
- **读指标**：有（Business Management API Analytics）。端点示例：
  `GET /<WABA_ID>/template_analytics?start=..&end=..&granularity=daily&metric_types=cost,clicked,delivered,read,sent`
  另有 template_group_analytics / call_analytics / group_analytics；metric 值含 sent/delivered/read/cost/clicked（url_button、unique_url_button）；日粒度、90 天回溯。启用需先 `POST /<WABA_ID>?is_enabled_for_insights=true`。需 System User 令牌。

## 2. 审核要求与门槛
- 需要 Meta 开发者应用 + WhatsApp Business Account（WABA）；消息模板需**模板审核**；Display name 有审核规则。
- **企业验证（Business Verification）**：原文（overview）：
  > "Business portfolios can be verified, and verification status factors into improved functionality, such as higher throughput and Official Business Account status."
  （验证为可选，影响吞吐与官方企业账号身份。验证所需具体材料清单未逐条取证，标注：以 Meta 官方 verification 流程为准，本笔记未单独取证。）
- 用户 opt-in 强制：overview 原文 "You must obtain user opt-in before sending message templates."
- 未发现对普通 Cloud API 使用场景的 App Review 要求（主要审核项为模板审核 + 企业验证）。

## 3. 限流数值（均带来源原文）
- **吞吐（throughput）**，overview 原文：
  > "Business phone numbers can send up to 80 messages per second by default, with capacity upgrades available."
  → 80 条/秒/电话号码（默认，可升级）。
- **单用户突发**，overview 原文：
  > "You may send up to 45 messages in a 6-second burst, but this 'borrows' from your future quota. After a burst, you must wait the equivalent time… To manage post-burst throttling, if a send request fails, retry after 4^X seconds (starting with X=0 and increasing X by 1 after each failure) until successful."
  → 45 条/6 秒突发（借用后续配额），失败按 4^X 秒退避。
- **消息限额（messaging limits）**，messaging-limits 页原文：
  > "Messaging limits are the maximum number of unique WhatsApp user phone numbers your business can deliver messages to, outside of a customer service window, within a moving 24-hour period."
  > "Newly created business portfolios have a messaging limit of 250, but this messaging limit can be increased to: 10,000 (via automatic scaling), 100,000 (via automatic scaling), Unlimited (via automatic scaling)."
  → 新组合 250 唯一用户/滚动 24 小时；自动扩至 10k / 100k / Unlimited。字段 `whatsapp_business_manager_messaging_limit`（示例值 TIER_250）。
- **Graph API 平台限流**（rate-limiting 页原文）：App 级 "Calls within one hour = 200 * Number of Users"（滚动 1 小时窗口）；用户级数值不公开；响应头 X-App-Usage（call_count/total_time/total_cputime 百分比）；错误码 4（app 限流）、17（用户限流）、613（自定义限流）、80008（WhatsApp Business Management API BUC 限流）。
- **Webhook**：事件通知批量最多 1000 条/批，失败重试最长 36 小时（webhooks getting-started 原文）。

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）封号风险
- 官方禁令，overview 原文：
  > "All WhatsApp Business Platform use must comply with our terms and policies. **Using unauthorized third-party tools is prohibited.**"
- 商业政策第 7 条（Enforcement）原文：
  > "If you use or operate a service which utilizes WhatsApp in violation of our terms or policies, such as messaging people at scale in an unauthorized manner, **we have the right to limit or remove your access to WhatsApp for Business.**"
  > "To maintain high quality conversations on WhatsApp, we enforce on WhatsApp Business Accounts that violate the WhatsApp Business Messaging Policy…"（含账号 Suspended/Terminated 后的申诉路径章节）
- **结论：风险等级=高（官方依据充分：明令禁止非授权第三方工具 + 政策执行可停用/移除业务账号）**。具体"封号概率/检测阈值"数值官方未披露 → **未证实**。

## 未证实/未覆盖项
- Business Verification 具体材料清单与审批时长（未单独取证）。
- 商业发起的对话计费价格（本轮未取证，属定价页）。
- 自动化封号具体概率与风控检测机制细节（官方不披露）。
