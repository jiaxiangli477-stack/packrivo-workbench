# Pinterest 平台研究笔记

> 调研日期：2026-10-25。来源：developers.pinterest.com 官方文档（getting-started、key-concepts/access-tiers、reference/rate-limits、API 参考内嵌操作索引）、policy.pinterest.com/en/terms-of-service（服务条款）、pinterest/pinterest-python-sdk（官方 SDK，GitHub）。
> 说明：Pinterest API 为 **v5**，采用 **Trial access / Standard access 两级**；新应用需提交申请并人工审核。

## 1. 官方 API 能力（逐项）

| 能力 | 结论 | 依据 |
|---|---|---|
| 发帖（创建 Pin） | ✅ 支持。`POST /pins`（operationId `pins/create`，"Create Pin"）在本人 board 或 board section 上创建 Pin；另有 `POST /boards`（boards/create）建板、`POST /pins/{pin_id}/save`（保存他人 Pin 到自己的板）。Trial access 创建的 Pin/Board 为 Sandbox 实体、仅创建者可见；Standard access 为真实可见。 | API 参考操作定义（https://developers.pinterest.com/docs/api/v5/ ）：`"pins/create":{"path":"/pins","method":"post",...,"summary":"Create Pin"}`；https://developers.pinterest.com/docs/key-concepts/access-tiers/（"Pins and Boards created with Trial access are only visible to their creator as Sandbox entities"） |
| 读评论 | ⚠️ 无专用评论读取端点。API 参考操作索引（302 个操作）中**不存在任何 comments 操作**（无 `GET/POST /pins/{pin_id}/comments`）；"comment" 仅出现在分析指标字段 `total_comments`（Pin 指标的评论数）。→ 当前 v5 无法逐条读取/写入评论，只能拿到评论计数。 | 操作索引全文（302 个 operationId，无 comment/conversation/message 类）；官方 SDK organic 模块仅 `boards.py`+`pins.py`（https://github.com/pinterest/pinterest-python-sdk ） |
| 写评论 | ⚠️ 同上，无写评论端点（历史 v5 曾有的 pins_comments 操作在当前参考索引中已不存在）。 | 同上 |
| 读私信 | ❌ 无。API 参考中无任何私信/messaging/conversation 操作；Pinterest v5 无 DM API。 | 操作索引（302 个操作中无 message 类）；官方 SDK 亦无 |
| 读指标 | ✅ 支持。`GET /pins/{pin_id}/analytics`（pins/analytics，"Get Pin analytics"，含 90 天与生命周期指标）、`/user_account/analytics`、`/user_account/analytics/top_pins`、`/boards/{board_id}/analytics`、`/businesses/{business_id}/analytics` 等；指标含 total_comments、total_reactions、save、video_avg_watch_time 等。Pin 指标限"本人拥有的 Pin 或共享给该账号的 group board"，2023-03-20 前创建的 Pin 生命周期指标可能缺失。 | 操作索引：`"pins/analytics":{"path":"/pins/{pin_id}/analytics","method":"get",...,"summary":"Get Pin analytics"}`；https://developers.pinterest.com/docs/key-concepts/access-tiers/（"Pin Analytics: Yes / Yes"） |

## 2. 审核 / 准入要求（官方，含门槛）

来源：https://developers.pinterest.com/docs/key-concepts/access-tiers/ 与 getting-started 页。
- 前置：注册/登录 **business 账号** → 验证邮箱 → My apps 接受开发者条款 → 填表提交申请，**Pinterest 人工审核**（邮件通知结果）。
- **Trial access**（首级，人人可申）：可用于探索；发 Pin/建 Board 仅创建者可见（Sandbox）；限流低。
- **Standard access**（生产级）升级条件：
  1. 必须已获 Trial access 并合规于 Developer Guidelines；
  2. **提交演示视频**，展示 app 通过 OAuth 流程完成一次 API 动作（仅自己用也要录，Postman/终端录屏均可）；
  3. 常见拒因：隐私政策缺失/不可访问、app 描述不清、**演示未展示 OAuth 用户授权流程**、**收集用户登录凭证或 Pinterest session cookies（官方原文："If you use other methods, such as collecting user login credentials or Pinterest session cookies, your upgrade request may be denied."）**、演示无真实 Pinterest 集成。
- 2026-09-14 后注册的应用，请求非商业用户的 board/Pin 可能收到 HTTP 403 `PINNER_DATA_ACCESS_DENIED`。
- 申诉走 Help Center ticket。

## 3. 限流数值（窗口+适用条件，官方 rate-limits 页）

来源：https://developers.pinterest.com/docs/reference/rate-limits/ （原文："All rate limits are subject to change without notice."）
- **通用限流**：Trial access = **1,000 请求/天**（所有 API 请求合计）；Standard access = **100 请求/秒/用户/应用**。
- **分类限流表**（Trial 单位=请求/天/应用；Standard 单位=请求/分钟/用户/应用）：
  - `org_write`（创建/编辑/删除 boards、board sections、**Pins**）：Trial **300/天**，Standard **100/分钟**
  - `org_read`（读用户账号、boards、board sections、Pins）：Trial 1,000/天，Standard 1,000/分钟
  - `org_analytics`（用户相关分析数据：账号信息、top Pins 等）：Trial 1,000/天，Standard **60/分钟**
  - `ads_write`：Trial 300/天，Standard 400/分钟；`ads_read` 1,000/1,000；`catalogs_read`/`catalogs_write` 1,000/100；`trends_read` 1,000/60
  - `ads_conversions`（特例）：Trial 1,000/天/广告账号/应用；Standard 120,000/分钟/广告账号/应用；用 conversion access token 可无限发送
- 响应头：`x-ratelimit-limit / x-ratelimit-remaining / x-ratelimit-reset`。
- 限流调整：Help Center → API Technical Support 提交请求。

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控

- **服务条款禁止未经授权的自动化访问**（来源：https://policy.pinterest.com/en/terms-of-service ）：
  - 原文（截断处为止）："In using Pinterest, you agree not to scrape, collect, search, copy or otherwise access data or content from Pinterest in unauthorized ways, such as by using automated means (without our express prior pe[rmission]...)"
- **API 审核层面**：Standard access 升级明确拒绝"collecting user login credentials or Pinterest session cookies"（收集登录凭证/会话 cookie 代替 OAuth 属不合规，见上）。
- 结论：**官方 ToS 禁止未经授权的自动化手段；用真实账号凭证/cookie 驱动浏览器自动化明确属不合规路径**。实际封号率、风控检测机制官方未公开 → **未证实**。

## 5. 证据文件路径（本机留存）

- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\pin-docs-llms.txt`（1MB，docs 站点 llms 导出，含 API 参考 302 个操作完整索引）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\pin-tos.html`（Pinterest 服务条款原始 HTML）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\pin-sdk-pins.py`、`pin-sdk-client.py`（官方 SDK 源码，证明仅 boards/pins 模块）
- access-tiers 与 rate-limits 两页为 WebFetch 在线获取（摘录见上表）。
