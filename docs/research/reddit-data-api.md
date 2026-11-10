# Reddit Data API — 研究笔记

抓取日期：2026-10-25
说明：官方帮助中心 https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki 直连与代理均被 Cloudflare 拦截（403 "Just a moment"），改取 **web.archive.org 快照**（https://web.archive.org/web/2025id_/https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki ，200 OK）。其余页面直连成功。
原始抓取产物：task workdir i28\fetch\ 下 rd_devapi.html / rd_devterms.html / rd_help_wb.html / rd_ua.html / rd_wiki_api.html

## 来源 URL
- API 文档（端点参考）：https://www.reddit.com/dev/api/
- Data API Wiki（官方，经 wayback）：https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki
- 开发者条款：https://www.redditinc.com/policies/developer-terms
- 旧官方 wiki（历史限流值对比）：https://github.com/reddit-archive/reddit/wiki/API

## 1. 官方 API 能力（dev/api 页面分组实录）
端点分组：account / announcements / captcha / emoji / flair / links & comments / listings / live threads / private messages / misc / moderation / new modmail / search / subreddits / users / widgets。
- **发帖**：有。`POST /api/submit`（scope: submit）、`POST /api/comment`（scope: submit）。
- **读评论**：有。`GET [/r/{subreddit}]/comments/{article}`（scope: read）。
- **读私信**：有。private messages 分组：`GET /message/{where}`（scope: privatemessages）、`POST /api/compose`（privatemessages）；"a message reply to that message (requires privatemessages scope)"。
- **读指标**：**无**。端点分组中无 analytics/insights 类目；官方 Data API 未提供帖子级浏览量/互动等指标端点（observed：dev/api 与 Data API Wiki 均未收录）。子版块订阅数等基础计数可经 about 类端点获取。帖子数据（views/upvote rate）仅官方 App 内展示。

## 2. 审核要求与门槛
- 需注册 OAuth 应用（https://www.reddit.com/prefs/apps）。
- Developer Terms 原文：
  > "Your App must comply with all specifications and requirements in the Developer Documentation. You understand and agree that Reddit may require you to submit your App for Reddit's review and approval at Reddit's discretion ("App Review"), including prior to distributing it through the Developer Platform…"
  > "If you are interested in using the Reddit Services and Data for commercial purposes, research in excess of rate limits, or for any use that is not expressly permitted under the Developer Terms, you will need to enter into a separate agreement with Reddit."
  → App Review 为 Reddit 酌情触发；**商业用途需单独协议**（即付费 API 档）。

## 3. 限流数值（Data API Wiki 原文，wayback 快照）
- 免费档：
  > "We enforce rate limits for those eligible for free access usage of our Data API. The limit is: **100 queries per minute (QPM) per OAuth client id**."
  > "QPM limits will be an average over a time window (**currently 10 minutes**) to support bursting requests."
  → 100 QPM / OAuth client id，按 10 分钟窗口平均。
- 响应头：X-Ratelimit-Used / X-Ratelimit-Remaining / X-Ratelimit-Reset。
- 聊天消息附加限流（同页）："2,000 messages per day per recipient；3,000 messages per day total"；"Bot API users can join up to 300 chat rooms per day."
- 强制 OAuth："Traffic not using OAuth or login credentials will be blocked, and the default rate limit will not apply."
- 历史对比（reddit-archive wiki，2023 前规则）："Clients connecting via OAuth2 may make up to 60 requests per minute."（现已被 100 QPM 替代，注意引用时标注时效）。

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）封号风险
- Developer Terms 原文：
  > "If you exceed (or Reddit believes that you have attempted to circumvent) rate limits or other controls to limit use of the Developer Platform, then your Devvit App and your ability to use the Developer Platform and other Reddit Services and Data may be temporarily suspended or permanently blocked."
  > "…circumvent or exceed reasonable limitations on calls and use of Reddit Services and Data… or otherwise use Reddit Services and Data in a manner that Reddit believes constitutes excessive or abusive usage…"
- Data API Wiki 原文："Traffic not using OAuth or login credentials will be blocked" → Playwright/CDP 驱动真实账号属非 OAuth 自动化流量，官方直接阻断 + 条款明确可临时停用/永久封禁。
- User Agreement 页（redditinc.com）本轮抓取为 JS 渲染壳，正文未取到（未引用其条款）。
- **结论：风险等级=高（官方依据充分：非 OAuth 流量阻断 + 违规可 suspend/permanent block）**。具体封禁率/检测阈值数值官方未披露 → **未证实**。

## 未证实/未覆盖项
- 付费档（1000/10000 QPM）具体价格（属商业协议，未公开定价表，未取证）。
- 新账号发帖频率限制（posting frequency）数值：Data API Wiki 快照中未检索到（"posting frequency: NOT FOUND"），官方未在该文档披露 → 未证实。
- User Agreement 自动化条款正文（页面 JS 渲染，未取到）。
