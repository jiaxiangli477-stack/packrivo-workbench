# Telegram Bot API — 研究笔记

抓取日期：2026-10-25
原始抓取产物：task workdir i28\fetch\ 下 tg_bots.html / tg_api.html / tg_tos.html（curl 直连 telegram.org，全部 200）

## 来源 URL
- Bots FAQ（限流原文所在页）：https://core.telegram.org/bots/faq
- Bot API 参考：https://core.telegram.org/bots/api
- Bots 介绍：https://core.telegram.org/bots
- 服务条款：https://telegram.org/tos

## 1. 官方 API 能力
- **发帖**：有。sendMessage/sendPhoto/… 全套发送方法（api 参考）；bot 可加入频道，需管理员权限，api 参考中 ChatAdministratorRights 原文：
  > "True, if the administrator can post messages in the channel, approve suggested posts, or access channel statistics; for channels only"
- **读评论**：Telegram 无公开"帖子评论"体系（频道可关联讨论组）。bot 能收到的消息（FAQ 原文）：
  > "All bots, regardless of settings, will receive: All service messages. All messages from private chats with users. All messages from channels where they are a member."
  > "By default, bots added to groups only see relevant messages in the chat (see Privacy Mode)."
  → 群里默认仅见相关消息（隐私模式）；讨论组中的"评论"消息同理，非通用评论读取接口。
- **读私信**：有（用户发给 bot 的私聊消息，bot 必收，见上 FAQ 原文）；接收方式 getUpdates（长轮询，返回最早 100 个未确认更新）或 setWebhook（HTTPS，端口 443/80/88/8443）。用户之间的私信 bot 不可读。
- **读指标**：**无**。tg_api.html 全文检索 "statistics" 仅出现在管理员权限描述（频道统计为官方客户端能力）；Bot API 参考中无任何 metrics/analytics 方法，仅有 getChatMemberCount 等基础成员计数。→ 官方 Bot API 未提供帖子/频道指标接口（observed：参考文档未收录；"未来会加"的可能不排除，故仅表述为"当前未提供"）。

## 2. 审核要求与门槛
- **无应用审核流程**。FAQ 原文：
  > "In order for a bot to work, set up a bot account with @BotFather, then connect it to your backend server via our API."
  → 创建即用，无企业审核、无门槛、无计费（Bot API 本身免费；付费广播/Telegram Stars 为可选增值）。
- Telegram Passport（处理个人身份数据）另需专项流程（本轮未取证）。

## 3. 限流数值（FAQ "My bot is hitting limits" 原文，全引）
- 单聊："In a single chat, avoid sending more than **one message per second**. We may allow short bursts that go over this limit, but eventually you'll begin receiving 429 errors."
- 群组："In a group, bots are not be able to send more than **20 messages per minute**."
- 广播："bots are not able to broadcast more than about **30 messages per second**"（未开付费广播；超过收 429）。
- 付费广播（api-changelog 2024-10-31 / FAQ）：开启后可到 **1000 messages per second**；超出 30/s 的部分每条 **0.1 Stars**；开启条件：bot 余额 ≥ **100,000 Stars** 且月活用户 ≥ **100,000**。
- 文件：getFile 仅 ≤20 MB；上传 ≤50 MB。
- getUpdates：返回最早 100 个未确认更新，用 offset 确认。

## 4. 浏览器自动化（Playwright/CDP 驱动真实账号）封号风险
- ToS 全文检索（tg_tos.html）：**无**明确禁止用户机器人（MTProto userbot/真实账号自动化）条款；唯一相关禁令：
  > "Telegram additionally prohibits data scraping as part of its Content Licensing and AI Scraping Terms, which apply to all users, businesses, and third-party services accessing the platform."
- 官方对真实账号浏览器自动化（userbot）的封号政策、检测手段、概率：**官方文档无任何依据 → 封号风险等级：未证实**。仅能确认"数据抓取"被明确禁止；其余（社区普遍认为低风险）无官方来源，不做断言。

## 未证实/未覆盖项
- userbot/浏览器自动化封号风险等级（无官方依据）。
- 频道统计数值（views 等）的 API 化可能性（当前 Bot API 未提供）。
- Telegram Passport 审核流程细节。
