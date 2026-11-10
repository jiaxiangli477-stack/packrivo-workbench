# YouTube 平台研究笔记

> 调研日期：2026-10-25。来源：developers.google.com/youtube（Data API v3 / Analytics API 官方文档）、youtube.com/t/terms（YouTube 服务条款）。
> 注：YouTube 的"发帖"有两类：视频上传（API 支持）与社区帖子 Community Posts（API 不支持）。私信（DM）YouTube 无此产品形态。

## 1. 官方 API 能力（逐项）

| 能力 | 结论 | 依据 |
|---|---|---|
| 发帖（上传视频） | ✅ 支持。`videos.insert` 可通过 OAuth 2.0 直接上传视频文件（官方提供完整 Python 上传示例脚本）。 | https://developers.google.com/youtube/v3/guides/uploading_a_video（"This guide provides and explains a Python script that uploads a YouTube video using the YouTube Data API."） |
| 发帖（社区帖/图文动态） | ❌ 不支持。Data API v3 资源类型中无社区帖子资源（资源列表：activity/channel/channelBanner/channelSection/guideCategory/i18n*/playlist/playlistItem/search/subscription/thumbnail/video/videoCategory/watermark + captions/comments 等）。 | https://developers.google.com/youtube/v3/getting-started（"Resources and resource types" 表，逐项为上述资源，无 posts/community） |
| 读评论 | ✅ 支持。`commentThreads.list`（每调用 1 quota）与 `comments.list`（1 quota），还有 `commentThreads.insert`（50）/ `comments.insert`（50）可写评论；另有 `comments.setModerationStatus`（50）等审核操作。 | https://developers.google.com/youtube/v3/determine_quota_cost（配额成本表：commentThreads list 1 / insert 50 / update 50；comments list 1 / insert 50 / setModerationStatus 50） |
| 写评论 | ✅ 支持（同上 commentThreads.insert / comments.insert，需 OAuth）。 | 同上 |
| 读私信 | ❌ 无。YouTube 无 DM 产品形态；Data API v3 无任何 messaging 资源/方法。 | getting-started 资源表（无 messaging 类资源）；配额成本表（全部 22 组资源，无 DM） |
| 读指标 | ✅ 支持，两层：① Data API `videos.list?part=statistics`（viewCount/likeCount/commentCount 等，1 quota/次）；② **YouTube Analytics API**（v2，channel reports / content owner reports，提供 views、estimatedMinutesWatched、likes、comments、subscribersGained 等维度指标；配额按查询成本计）。 | https://developers.google.com/youtube/analytics/ 及 /youtube/analytics/v1/channel_reports、/youtube/analytics/v1/dimsmets/mets（指标列表）；实现指南 videos 页示例 `videos.list?part=snippet,statistics`（https://developers.google.com/youtube/v3/guides/implementation/videos） |

## 2. 审核 / 准入要求

- **无"应用审核"流程**：创建 Google Cloud 项目 → 启用 YouTube Data API → 取 API Key（公开数据只读）或 OAuth 2.0 client（需用户授权的操作：上传、评论、订阅等）。API Key 无需审核。
- **配额扩容需审计**：默认配额之上如需扩容，必须先完成 **API Compliance Audit**（提交 Audit and Quota Extension Form，YouTube API Services 团队审核用途）；此后 12 个月内扩容免重复审计；另有**周期性审计**、失败申诉、控制权变更申报等机制。
- OAuth 敏感作用域（youtube.upload 等）在 Google Cloud 的 OAuth consent screen 需通过 Google 验证流程（一般阈值：未验证应用外测用户≤100）——此为 Google 通用机制，本文未抓取 YouTube 专门页原文，**具体验证门槛未证实**。
- 来源：https://developers.google.com/youtube/v3/getting-started（Before you start）、https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits

## 3. 限流 / 配额数值（窗口+适用条件）

- **默认配额（每个启用 Data API 的项目）**：`search.list` 每日 **100 次**（独立桶，每次 1 配额点）、`videos.insert` 每日 **100 次**（独立桶，每次 1 配额点）、其余所有端点合计 **10,000 units/天**。配额每天太平洋时间（PT）午夜重置。
- 原文："Projects that enable the YouTube Data API have a default quota allocation of 100 search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints."（determine_quota_cost 与 quota_and_compliance_audits 两页一致）
- **关键端点配额成本**（单位=quota units/次，扣每日 10,000 桶）：videos.list=1、videos.insert=1（但另有 100/天独立桶）、channels.list=1、playlists.list=1 / insert=50、commentThreads.list=1 / insert=50、comments.list=1 / insert=50、search.list=100 quota per day（每次调用 1 quota）、captions.insert=400 / update=450、playlistItems.insert=50、liveChatMessages.insert=20。所有请求（含无效请求）至少消耗 1 点。
- **YouTube Analytics API**：文档表述为"API server evaluates each query to determine its quota cost"（按查询成本计），未在页面给出固定每日默认值 → **默认日配额数值未证实**（需在 GCP 配额页查看）。
- 来源：https://developers.google.com/youtube/v3/determine_quota_cost 、https://developers.google.com/youtube/analytics/quota_usage

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）风控

- **服务条款明令禁止**（来源：https://www.youtube.com/t/terms ，Terms of Service）：
  - 原文（"Permissions and Restrictions" 部分）："access the Service using any automated means (such as robots, botnets or scrapers) except (a) in the case of public search engines, in accordance with YouTube's robots.txt file; or (b) with YouTube's prior written permission;"
- 结论：**无 YouTube 书面许可的浏览器自动化（含 Playwright/CDP 驱动登录账号）违反 ToS，属官方禁止行为**；实际封号率/风控检测细节官方未公开量化 → **未证实**。
- 另：API 侧有 Developer Policies 与 Required Minimum Functionality 约束（未逐条抓取）。

## 5. 证据文件路径（本机留存）

- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\yt-quota.html`（配额成本表原始 HTML，含全表）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\yt-analytics.html`（Analytics API 概览）
- `E:\Ai\ARTEX-Portable\app\data\tasks\5\i27\yt-an-quota.html`（Analytics 配额说明页）
- 上传指南 / 审计页为 WebFetch 在线获取（未落盘，摘录见上表）。
