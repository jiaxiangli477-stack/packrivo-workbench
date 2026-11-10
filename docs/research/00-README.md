# 四平台研究笔记索引（LinkedIn / Facebook Page / Instagram / TikTok）

采集日期：2026-10-25，采集者：探索意图 #26。方法：逐平台抓取官方开发者文档原文，失败项重试/换路径/官方站内搜索/Web Archive；所有「未证实」项均为官方来源未提供或页面不可抓取，未做推测。

| 文件 | 平台 |
|---|---|
| [linkedin.md](./linkedin.md) | LinkedIn |
| [facebook-page.md](./facebook-page.md) | Facebook Page |
| [instagram.md](./instagram.md) | Instagram |
| [tiktok.md](./tiktok.md) | TikTok |

## 一分钟结论速览

| 平台 | 发帖 | 读评论 | 读私信 | 读指标 | 审核门槛 | 已证实限流 | 浏览器自动化风险 |
|---|---|---|---|---|---|---|---|
| LinkedIn | ✅ | ✅ 读写 | ⚠️ 未证实 | ✅ 多项 Statistics | Development→Standard Tier | 24h 周期；Dev Tier 500/app、100/member | 高（UA §8.2 明文禁令） |
| Facebook Page | ✅ /feed | ✅ /comments | ✅ conversations+Send API(24h窗口) | ✅ /insights(≥100赞) | App Review+Page 任务 | 平台级 200×用户/小时；BUC 未公开 | 高（Meta 条款 §3.2 明文禁令） |
| Instagram | ✅ 容器法(仅专业账户) | ✅ 读写/隐藏 | ✅ messages(24h窗口) | ✅ 用户级+媒体级 | Advanced Access | 发布 50/24h；消息 300/s、10/s、750/h | 高(inferred，IG ToU 原文未抓到) |
| TikTok | ✅ 须审计 | ❌ 无 | ❌ 仅 Portability 导出 | ⚠️ 仅主页统计 | scope 审批+审计 | 发帖 6 次/分/用户 | 高(开发者条款 III.3(k)/(m) 明文禁令) |

## 原始抓取响应存放
WebFetch 完整响应已持久化到本任务工作目录 `E:\Ai\ARTEX-Portable\app\data\tasks\5\i26\cmd-output\`（output-*.txt）。核引文可据此定位。

## 给汇总者的提示
- LinkedIn 500/100：官方窗口为「24 小时周期」，FAQ 未注窗口 → 矩阵写「约 500/app/天、100/member/天（Development Tier，官方 FAQ）」并附两页 URL。
- Facebook/Instagram 的 BUC 限流数值官方不公开 → 写「未公开（未证实）」。
- Instagram「200 次/小时」流传值未获本批官方文档确认 → 勿写为已证实。
- 自动化封号：官方条款明文禁令已抓到（LinkedIn/Meta/TikTok 开发者条款），但「风控等级」官方无分级 → 标注为基于条款禁令的推断（inferred），封号阈值全部标未证实。

## 其他契约笔记

| 文件 | 内容 |
|---|---|
| [postiz-public-api.md](./postiz-public-api.md) | Postiz 公开 API v1：端点、鉴权、建帖请求体、27 个平台 settings、媒体限制、错误码（2026-10-26，取自官方 openapi.json） |
