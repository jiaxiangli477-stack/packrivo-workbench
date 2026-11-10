# 外贸社媒工作台 · 竞品功能拆解

> 文档结构：一、概述；二、多平台排期与数据（Hootsuite / Buffer）；三、私信自动化（ManyChat / Chatfuel）；四、领英获客工具；五、外贸独立站营销工具；六、差异化空档结论。
> 各章节由独立调研任务写入，来源与访问日期随章节标注。

<!-- SECTION:i23-multi-platform BEGIN -->
## 二、多平台排期与数据：Hootsuite / Buffer

> 调研口径：仅取官方功能页 / 定价页 / 帮助文档，未采信第三方评测。
> 访问日期：2026-10-25（全部链接均为当日抓取；Buffer 定价页自述价格最近一次更新为 2025-11）。

### 2.1 Hootsuite

**定位**：面向中大型品牌与代运营团队的「Social OS」套件，五条产品线打包售卖：Perch（内容规划与发布）、Nest（社媒收件箱与客服）、Lumen（洞察与聆听）、Wisdom（社媒 AI）、Parliament（员工倡导），外层再加 Advertising（付费广告管理）与 Analytics。[S1][S2][S7]

#### 核心模块

| 模块 | 官方描述的关键能力 | 来源 |
|---|---|---|
| Perch（排期/发布） | 日历视图 + 列表视图统一管理自然与付费内容；推荐最佳发布时间；批量排期一次最多 350 条；可在危机/机会出现时暂停已排期帖子；内置 Canva / Adobe Express 模板、免费图库、自动打标签的 hashtag 生成器；自定义审批流；可在 ChatGPT / Claude / Gemini / Copilot 内通过 MCP 连接器直接起草、排期、查数据 | [S2] |
| Nest（收件箱/客服） | 社媒收件箱与客户服务（页面标题即 "Social Media Customer Service Software"）；Professional 起支持自动回复与 DM 工作流、AI 智能回复、会话自动打标；Advanced 起支持消息分配、按技能路由、CSAT 问卷、团队产能统计 | [S1][S6] |
| Lumen（洞察/聆听） | 社媒聆听与媒体监测；Professional 为 30 天 Quick Search（可同时对比 5 组结果、可导出）；Enterprise 提供 13 个月历史数据、更多数据源、告警、定时报告、品牌评论监测 | [S1][S7] |
| Wisdom（AI） | 每个档位都内置的 AI 助手：起草、建议、分析；MCP 连接器打通外部 AI 聊天工具 | [S1][S2] |
| Analytics（数据） | 帖子级表现、竞品对标（Standard 5 个 / Professional 20 个）、自定义报告与定时导出；Advanced Analytics（原 Hootsuite Impact，含社媒花费/ROI、自定义指标、GA/Adobe Analytics 接入）是 Enterprise 附加能力 | [S1][S5] |
| Advertising / Parliament | 社媒广告管理；员工倡导（仅 Enterprise） | [S1] |

#### 定价档位差异（按用户席位计价，年付口径）[S1]

| 档位 | 价格 | 社媒账号数 | 关键增量 |
|---|---|---|---|
| Standard | $99 / 用户 / 月 | 最多 10 个 | 无限排期、AI 生成帖子与图片、统一收件箱、品牌与竞品监测、可加购席位 |
| Professional | $199 / 用户 / 月 | 无限 | 收件箱自动回复与工作流、AI 智能回复、会话自动打标；30 天聆听 Quick Search、90 天趋势预测、导出聆听结果、20 个竞品对标；自定义/定时/导出报告；链接自动缩短与追踪、自动加热高表现帖子 |
| Advanced | $399 / 用户 / 月 | 无限 | 审批流与内部评论、可暂停已排期帖；消息分配与技能路由、CSAT 问卷、团队产能；高级报告导出（可加 logo/图片、站内共享、外发邮件） |
| Enterprise | 定制（需 demo） | 无限 | Advanced Analytics（花费/ROI/归因）、13 个月聆听历史与高级数据源、SSO 与合规方案、Salesforce 集成、Parliament 员工倡导、专家服务 |

补充：14 天试用无需信用卡；试用期每组织每日发帖上限 10–20 条且**不支持批量排期**；Standard/Professional/Advanced 均可月付或年付，年付单价更低；非营利组织有折扣。[S1]

#### 明显功能缺口

1. **纯席位计价，没有低价/按渠道档位**：Standard 单席 $99/月且只给 10 个账号；3 人团队用 Advanced 即 $399×3≈$1,197/月（年付口径，未含税）。对「1–2 人管几十个账号」的外贸小团队，成本结构不友好。[S1]
2. **协作与治理能力被锁在高档**：内容审批、内部评论、消息分配/技能路由只在 Advanced 起；Standard/Professional 无审批流。[S1]
3. **真正的 ROI/归因分析是 Enterprise 专属**：Advanced Analytics（原 Impact）需 demo 报价，自助档位拿不到花费-回报闭环。[S5]
4. **数据新鲜度受平台侧限制**：Facebook 指标每天更新一次，Instagram 每 48 小时更新、最长可能 64 小时才出现在面板——不适合按小时响应的线索/投放场景。[S5]
5. **无永久免费版**：只有 14 天试用，且试用期禁批量排期、日发帖受限。[S1]
6. **原生渠道清单偏欧美主流平台**（Facebook / Instagram / X / LinkedIn / TikTok / YouTube / Pinterest / Threads / Bluesky）；未在官方渠道列表看到 WhatsApp、Telegram、微信、小红书、LINE 等外贸/亚洲常用渠道（据官网渠道清单缺失推断，未逐条核验应用市场插件）。[S2][S3]

### 2.2 Buffer

**定位**：以「简单、按渠道付费」为核心的轻量排期与数据分析工具，模块拆成 Create（选题库）、Publish（排期发布）、Insights（数据）、Community（评论互动）、Collaborate（协作）、Start Page（链接聚合页）、AI Assistant、API。[S3][S8]

#### 核心模块

| 模块 | 官方描述的关键能力 | 来源 |
|---|---|---|
| Publish（排期/发布） | 每个渠道可设自己的固定发布时间（各自时区）；支持 Next Available（下一个空位）/ Prioritize（置顶队列）/ 指定时间三种入队方式；多数平台自动发布、少数格式转为「提醒发布」；周/月日历视图，可按渠道、标签、帖子类型过滤，拖拽改期；支持线程帖、首条评论排期、渠道分组、链接缩短、自定义视频封面、草稿（全档位） | [S3][S4] |
| Create（选题库） | Ideas 选题库、草稿、模板、标签、Board 视图、浏览器插件抓取灵感；Free 100 条 ideas / 3 个标签，付费无限 ideas / 250 标签 | [S4] |
| Insights（数据） | 粉丝增长、互动、曝光、帖子表现；Free 仅 30 天历史，付费不限；付费含 Performance overview、自定义分析、报告、自定义 UTM；**品牌化报告仅 Team**；另有 Weekly Takeaways 把数据转成可执行建议 | [S4][S9] |
| Community（互动） | 只做**评论**：跨 Instagram、Facebook、LinkedIn、Threads、Bluesky、X、TikTok、Google Business Profile、YouTube、Mastodon 统一收评论、回复、评论评分、保存回复、AI 回复（Free 每周 5 条）、把评论转成新帖；全档位免费包含 | [S10] |
| Collaborate（协作） | Essentials 仅 1 个用户账号；Team 才有无限成员、渠道级访问权限、内容审批流；2FA 全档位 | [S4] |
| AI Assistant | 所有档位（含 Free）无限使用，用于生成、改写、缩写、改语气 | [S3][S4] |
| API / 集成 | REST API：Free 1 key/3,000 次/月，Essentials 3 key/7,500 次/月，Team 5 key/15,000 次/月；集成 Canva、Google Drive/Photos、Dropbox、OneDrive、Unsplash、Bitly、WordPress、Zapier、Make、n8n、IFTTT、ChatGPT、Claude、Cursor、Perplexity、Raycast | [S4] |

支持 12 个渠道：Facebook（Pages/Groups）、Instagram（business/creator/personal）、LinkedIn（Pages/Profiles）、TikTok（business）、YouTube（Shorts）、Pinterest（business/personal）、Google Business Profile、Threads、Bluesky、Mastodon、Substack、X（free/premium），外加 Start Page。[S4]

**渠道级能力差异（官方对比表，直接影响可用性）**：LinkedIn 个人号支持自动发布、基础分析、评论互动，但**不含高级分析**；Instagram 个人号、Facebook 群组只能「提醒发布」，无数据与互动；Google Business Profile 无分析；Pinterest 无高级分析且无评论互动；TikTok business、YouTube Shorts 均无高级分析。[S4]

#### 定价档位差异（按渠道计价）[S4]

| 档位 | 价格 | 渠道数 | 用户数 | 关键差异 |
|---|---|---|---|---|
| Free | $0 | 最多 3 个 | 1 | 每渠道 10 条待发（发完即释放名额）；100 ideas / 3 标签；Insights 仅 30 天；无首条评论排期、无渠道分组、无 hashtag 管理、无自定义视频封面；无报告/自定义分析；AI 回复每周 5 条、1 条保存回复；API 1 key/3,000 次/月 |
| Essentials | $6/渠道/月（年付约 $5） | 不限（量价递减） | **仅 1** | 无限排期（公平使用上限 5,000 条/渠道）、无限 ideas、250 标签、高级分析、报告、自定义 UTM、首条评论排期、渠道分组、hashtag 管理、自定义视频封面；API 3 key/7,500 次/月；**无审批流、无品牌化报告** |
| Team | $12/渠道/月（年付约 $10） | 不限 | 无限 | Essentials 全部 + 无限成员、访问权限分级、内容审批流、品牌化报告；API 5 key/15,000 次/月 |

渠道量价：1–10 渠道 $6/$12（Essentials/Team），11–25 渠道 $4/$4，26–50 $3/$3，51+ $1/$2（月付口径）。年付约省 2 个月；非营利 5 折；仅收信用卡/借记卡，不支持 PayPal、支票、转账。[S4]

#### 明显功能缺口

1. **没有社媒聆听 / 品牌监测 / 竞品对标**：官网功能导航与完整功能对比表里都没有 listening、brand monitoring、competitor benchmarking，Insights 只覆盖自有渠道——这是与 Hootsuite 最直观的能力差。[S3][S4][S9]
2. **没有私信（DM）能力，只有评论**：Community 的官方描述是统一管理并回复各平台*评论*，不做私信收件箱、私信自动化或客服工单；Facebook 群组连评论互动都不支持。[S10][S4]
3. **协作按「用户数」卡在最痛的位置**：Essentials 只给 1 个用户账号，只要第 2 个人要登录就必须上 Team，成本从 $6/渠道跳到 $12/渠道；且按渠道计费不按席位，渠道多时 Team 反而可能贵过 Hootsuite。[S4]
4. **审批流与权限分级仅 Team**；品牌化报告也仅 Team，Essentials 拿不到可交付给客户的带 logo 报告。[S4]
5. **标签容量上限 250**（Free 仅 3），大量 SKU / 多语种内容归档会不够用。[S4]
6. **渠道能力受平台 API 限制**：LinkedIn 个人号无高级分析；IG 个人号 / FB 群组 / Pinterest 个人号只能提醒发布；GBP、TikTok business、YouTube Shorts 无高级分析——对以 LinkedIn 个人号做外贸获客的场景，数据能力明显不足。[S4]
7. **没有广告投放管理与 ROI 归因模块**（Hootsuite 有 Advertising + Advanced Analytics，Buffer 两者皆无）。[S3][S4]
8. **原生渠道不含微信、小红书、抖音国内版、WhatsApp、Telegram、LINE**；只有 12 个海外平台（据官方渠道清单推断，未核验第三方集成）。[S4]

### 2.3 两家对比小结（供第四章「差异化空档」引用）

| 维度 | Hootsuite | Buffer |
|---|---|---|
| 计费单位 | 用户席位（$99–$399/席/月） | 渠道（$6/$12 每渠道/月，量价递减） |
| 入门门槛 | 仅 14 天试用，无免费版 | 永久免费（3 渠道 / 每渠道 10 条待发） |
| 多账号管理 | Standard 限 10 个，Professional 起无限 | 不限渠道，渠道越多单价越低 |
| 团队协作 | Professional 起自动化，Advanced 起审批/分配 | Team 起多成员、审批、权限 |
| 数据分析 | 帖子级 → 竞品对标 → Enterprise ROI/归因 | 粉丝/互动/曝光/帖子表现 + 报告；无竞品、无归因 |
| 聆听/监测 | 有（Lumen，30 天 → Enterprise 13 个月） | **无** |
| 私信/客服 | 有（Nest 统一收件箱 + 自动化） | **无（仅评论）** |
| 广告管理 | 有（Advertising 模块） | **无** |
| AI | 全档位 Wisdom + 外部 AI 聊天工具 MCP 连接 | 全档位 AI Assistant（生成/改写） |
| 批量操作 | 一次 350 条（试用期禁用） | 队列/日历批量拖拽，无单次条数上限说明 |
| 中国/亚洲渠道 | 官网未见 WhatsApp/微信/小红书/LINE | 官网未见 WhatsApp/微信/小红书/LINE |

**对本地化 + 多账号隔离的直接含义（待第四章展开）**：(a) 两家都不做微信/小红书/抖音国内版与 WhatsApp/Telegram，出海团队必须另拼工具；(b) Hootsuite 的席位制与 Buffer 的「Essentials 仅 1 用户」都让「多品牌/多店铺账号隔离 + 小团队协作」落在高价档；(c) 数据侧都存在平台侧延迟或渠道级缺失，谁能把「多平台排期 + 线索/私信 + 可交付报告」做进一个低价档，谁就吃到空档。

### 来源（访问日期均为 2026-10-25）

- [S1] Hootsuite Plans, Prices, and Features — https://www.hootsuite.com/plans
- [S2] Hootsuite Social Media Calendar and Scheduler（Perch）— https://www.hootsuite.com/platform/publishing
- [S3] Buffer Publish — https://buffer.com/publish
- [S4] Buffer Pricing（含完整功能对比表与渠道能力表）— https://buffer.com/pricing ；机器可读版 https://buffer.com/pricing.md
- [S5] Hootsuite Social Media Analytics Tools — https://www.hootsuite.com/platform/analytics
- [S6] Hootsuite Nest（Social Media Customer Service Software）— https://www.hootsuite.com/nest
- [S7] Hootsuite Lumen（Social Listening Tool & Media Monitoring）— https://www.hootsuite.com/lumen
- [S8] Buffer 功能导航：Create / Publish / Insights / Community / Collaborate / Start Page / AI Assistant / API — https://buffer.com/ （导航来源）
- [S9] Buffer Insights — https://buffer.com/insights
- [S10] Buffer Community — https://buffer.com/community
<!-- SECTION:i23-multi-platform END -->

<!-- SECTION:i25-linkedin BEGIN -->
## 四、领英获客工具：Dux-Soup / Expandi / Waalaxy / Dripify / HeyReach / LinkedHelper

> 调研口径：只取各工具官网的功能页、定价页与帮助/FAQ；价格均为页面当日标价（未含税，未计促销码），货币按页面原样标注（USD / EUR）。
> 访问日期：**2026-10-25**（下列全部链接均为当日抓取）。
> 说明：Dux-Soup 官网当前已把产品品牌改为 **STACKED（powered by Dux-Soup）**，定价与功能页均以 STACKED 呈现，页脚仍署名 Dux-Soup；本节的 Dux-Soup 数据即来自该新页面。

### 4.1 总览对比

| 工具 | 形态 | 名单/搜索入口 | 加好友与私信序列 | 收件箱 | CRM / 团队协作 | 计费单位 | 公开起步价（月付口径） | 试用 |
|---|---|---|---|---|---|---|---|---|
| **Dux-Soup (STACKED)** | 桌面客户端（Mac/Win）+ 浏览器 Dashboard；另有云托管版 | LinkedIn 搜索、Sales Navigator 列表、Recruiter 列表、CSV、粘贴 URL | 最多 12 步；Connect / Message / InMail / Visit / Follow / Endorse / Like | 三源统一收件箱（LinkedIn + Sales Nav + Recruiter） | Funnel Flow 阶段 + 标签 + 联系人档案 + CSV/CRM 导出；2+ 席位共享团队 campaign；Agency 用 STACKED Hosted | 每席位（local / cloud 两档） | $55/席位/月（local）；cloud $99 | 14 天 |
| **Expandi** | 纯云 | Sales Navigator 保存搜索/URL、CSV、帖子互动者、群组、活动；高级筛选 | 11+ campaign 类型，if-then 可视化序列，消息间可插 9 种动作；LinkedIn + 邮件跟进的“多渠道” | Global Smart Inbox | Workspaces：预置/自定义角色、100+ 权限项、按账号授权、客户报告、白标 | 每账号（+10 席位转 Agency 报价） | $99/账号/月（年付 $79） | 7 天 |
| **Waalaxy** | Chrome 浏览器扩展 | LinkedIn Basic / Sales Navigator / Recruiter Lite 导入、CSV、扩展抓当前页 | 无限 campaign、99+ 预置序列、自动跟进；Business 档加冷邮件序列 | Smart LinkedIn Inbox（**付费加购**，500 条对话免费） | CRM 同步（2000+ 工具）、团队工作区、共享分析、去重、统一付款 | 每用户（含每月邀请额度） | €19/用户/月（300 邀请/月） | 14 天 |
| **Dripify** | 纯云 | 导入名单 + Lead queue；兼容全部 LinkedIn 账号类型；自带 Email Finder / 数据增强 | 无限 campaign、无限步骤；**所有付费档**都含 LinkedIn + 邮件序列；条件/延时；Advanced 有 A/B 与 Evergreen | 内置 Dedicated Inbox（全档位） | 团队管理（角色、团队绩效、去重、模板共享）**仅 Advanced**；HubSpot 集成、Open API + MCP | 每用户（1 席位 = 1 个 LinkedIn 账号） | $79/用户/月（年付 $59） | 7 天，无需信用卡 |
| **HeyReach** | 纯云 | 不做采集；名单来自 Clay / RB2B / Trigify 等集成与 CSV | 无限 campaign；Connect / Message / Follow / 语音消息 / Profile view；If Connected 分支；邮件走 Instantly / Smartlead | Unified Inbox（跨全部 sender） | Workspaces + 权限，按客户隔离 sender/lead/campaign；用户数不收费 | **每 sender**（LinkedIn 账号） | $79/sender/月（年付 $64） | Growth 14 天（3 个账号）；Agency/Unlimited 可申请 30 天 |
| **LinkedHelper** | 桌面软件（非扩展），Local / Cloud 两种数据存储 | 站内/组织页搜索、帖子点赞评论者、群组成员、活动参与者、校友、Recruiter 项目、待处理邀请、公司员工、Auto-Collect、CSV/TXT/HTML | 无限 campaign、30+ 动作类型、if-then-else 模板、Spintax；AI 草稿队列 | 内置 Inbox | **内置 CRM**（备注/标签/收件箱）+ Workspaces（Owner/Admin/Member/Guest）+ 每账号独立数据空间 + 账号级权限 | 每授权（=1 个 LinkedIn 账号） | $15/授权/月起（本地年付低至 $8.25） | 14 天（Pro 全功能） |

### 4.2 Dux-Soup（官网现品牌 STACKED）

**定位**：老牌 LinkedIn 自动化工具，现拆成「本地桌面版」与「云托管版」两条部署线，功能卖点集中在 drip campaign、统一收件箱与线索漏斗。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 序列（Drip Campaigns） | 单序列最多 12 步，可任意排序 Connect / Message / InMail / Visit / Follow / Endorse / Like a post；每步可设自定义延时；检测到回复立即停止序列；内置账号安全（每日限额、随机停顿、自动活动上限、robot speed）；AI 按 LinkedIn 资料逐人个性化 | [L3] |
| 名单与搜索 | 从 LinkedIn 搜索、Sales Navigator 列表、Recruiter 列表、CSV、粘贴的 profile URL 批量入队；也可边浏览边逐个 enroll | [L3] |
| 收件箱 | Message Bridge 每 20 分钟轮询 LinkedIn / Sales Navigator / Recruiter 三个收件箱；回复自动移出序列；可用 ChatGPT / Claude / Gemini 判定「合格/不合格/继续」；可在 Funnel Flow 或 Slack 直接手动回复 | [L2] |
| 线索管理 | Funnel Flow 的 Enrolled / Invited / Accepted / Followups / Responded / Qualified 是真实列表；支持手动+自动打标、按标签批量取人、自动抓取姓名/职位/公司/连接度/邮箱/电话/地区；按 campaign、连接度、日期、姓名筛选；导出 CSV 或推送 CRM | [L4] |
| 账号安全 / 部署 | 本地版跑在自己的电脑（Mac/Win 桌面安装包）；云版由官方托管、持续运行；Agency 场景另有 STACKED Hosted（多客户一个 dashboard、云端常开、内置安全控制与报告） | [L1][L2][L4] |

#### 定价档位差异

| 档位 | 月付 | 年付（-25%） | 包含 |
|---|---|---|---|
| STACKED local | $55/席位/月 | $41.25/席位/月 | 桌面端本地运行；无限并发 campaign；AI 个性化；campaign 统计与线索管理；联系人导出；原生集成（Slack / Salesforce / Zapier / Make 等） |
| STACKED cloud | $99/席位/月 | $74.17/席位/月 | Local 全部 + 免开电脑持续运行、Tap-and-go 访问、官方托管的账号与安全管理 |

补充：功能页给 14 天免费试用；席位与计费方式在结账时选择；**共享团队 campaign 需要 2+ 席位**；兼容 LinkedIn / Sales Navigator / Recruiter；原生集成还包括 Pipedrive、HubSpot、SharpSpring、Freshsales、OpenAI、Anthropic、MS Teams、HighLevel。[L1][L3]

#### 明显缺口

1. **单平台**：只做 LinkedIn 系（含 Sales Nav / Recruiter），没有冷邮件序列、没有其它社媒渠道；跨渠道跟进要外接工具。[L1][L3]
2. **CRM 是「名单 + 阶段」，不是业务 CRM**：只有漏斗阶段、标签、联系人字段与导出/集成，没有报价、订单、样品、展会等外贸闭环。[L4]
3. **本地版必须开着电脑**，云版价格几乎翻倍（$55 → $99），小团队「常开」成本被动抬高。[L1]
4. **序列步数封顶 12 步**，且动作类型固定为 7 类，复杂分支（if/else）能力未见官方描述。[L3]
5. **多账号隔离未在定价/功能页说明**：页面只承诺「账号安全」（限额/随机停顿）与云版「robust security & account management」，未列明每账号独立代理/指纹；代理商能力放在需询价的 STACKED Hosted。[L1][L2]
6. 不支持免费档，只有 14 天试用。[L1]

### 4.3 Expandi

**定位**：LinkedIn-first 的云端外呼平台，强调「账号安全 + 可视化 if-then 序列 + 代理商 Workspaces」。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 序列与 campaign | 11+ 种 campaign 类型；可视化 if/action 序列；消息之间可插 9 种互动动作；支持在一条序列里做「加好友 → 私信 → 邮件跟进」的多渠道；campaign 优先级管理；A/B 测试；支持图片/GIF 个性化（**额外收费**）与 Senspark 视频个性化（**付费 add-on**） | [L5][L6] |
| 名单与搜索 | Sales Navigator 保存搜索/URL 直接进 campaign；CSV 导入；按帖子互动者、群组、活动构建受众；高级筛选；自动清洗姓名 | [L5][L6] |
| 收件箱 | Global Smart Inbox 统一收件箱 | [L6] |
| 账号安全 | 每账号独立、按国家匹配的 IP；profile 自动 warm-up；按官方大数据给出的每日动作限额区间（连接/私信/InMail/活动邀请）强制不越界；随机延时、去重、黑名单；Mobile Connector 等 campaign 类型可「绕过限额」多拿每周约 100 个连接请求 | [L5] |
| 团队 / 代理商 | Workspaces：邀请同事或客户（**不额外收用户费**）；可只共享某一个/某几个/全部账号；预置角色 + 自定义角色，100+ 权限项；Owner 独占账单权限；Agency 档含集中 campaign 管理、客户报告、模板共享、专属 CSM、白标 | [L7][L5] |

#### 定价档位差异

| 档位 | 价格 | 关键差异 |
|---|---|---|
| Business | $99/账号/月；年付 $79/账号/月（-20%，约等于送 2 个月） | 全部核心功能：无限 campaign、多渠道、智能收件箱、账号安全、统计、集成、黑名单 |
| Agency | 定制报价，10+ 席位起 | Business 全部 + 角色与权限管理、集中 campaign 管理、客户透明报告、模板共享、专属 CSM、专属支持、**白标**；席位越多折扣越大 |

补充：7 天免费试用，试用期开放全部功能；图片/GIF 个性化与视频个性化是额外付费项；官网未公布 10 席位以下的阶梯价，只写「席位越多越便宜」。[L5]

#### 明显缺口

1. **单人档只有一档**（$99），没有低价入门档/免费档；想压到 $79 必须年付。[L5]
2. **白标与细粒度权限被锁在 Agency 定制档**，10 席位以下的小代理拿不到。[L5]
3. **个性化是加价项**：图片/GIF 与视频个性化都要额外付费（视频还依赖第三方 Senspark）。[L5]
4. **LinkedIn-first**：所谓多渠道只是「LinkedIn 序列里插入邮件跟进」，没有独立邮件营销、没有其它社媒渠道。[L5][L6]
5. 纯云 SaaS，数据与账号会话都在官方服务器，不提供本地部署/数据驻留选项。[L5]
6. 定价页未说明每个「账号/席位」是否含独立代理，只写「dedicated country-based IP」；多账号的运行时隔离程度需以合同为准（**推断**）。[L5]

### 4.4 Waalaxy

**定位**：以 Chrome 扩展为载体的轻量 LinkedIn（+邮件）获客工具，主打低价、模板多、上手快，用户量 20 万+。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 序列与 campaign | 无限 campaign；99+ 预置 outreach 序列；自动跟进；智能回复检测（回复即停）；Business 档加冷邮件序列与自动邮件跟进、多 sender 账号 | [L8][L9] |
| 名单与搜索 | 从 LinkedIn Basic / Sales Navigator / Recruiter Lite 导入，CSV 导入导出；扩展直接在真实 profile 页面上建 campaign | [L8][L9] |
| 邮箱能力 | Email Finder：Pro/Advanced 每月 25 个 credit，Business 500 个；Business 才有多渠道（LinkedIn + email） | [L8] |
| 收件箱 | Smart LinkedIn Inbox：统一 LinkedIn 会话、保存回复、定时跟进、标签与线索整理、CRM 导出；**付费加购**，含 500 条免费对话 | [L8] |
| CRM / 团队 | CRM 同步（2000+ 工具）；团队工作区、共享线索列表与 campaign、共享分析、去重、多账号导入、统一付款；角色/权限/团队看板（首页口径） | [L8][L9] |
| 分析 | 回复率按 campaign 对比行业基准、情绪可视化、团队绩效看板 | [L9] |

#### 定价档位差异（每用户/月，月付口径）

| 档位 | 价格 | 每月邀请额度 | 关键增量 |
|---|---|---|---|
| Pro | €19 | 300 | 无限 campaign、预置序列、自动跟进、CRM 同步、团队协作、CSV、智能回复检测；25 email credits/月 |
| Advanced | €49 | 800 | Pro 全部 + 最高邀请额度、API 访问、Make/Zapier/n8n 模块、在线客服；25 email credits/月 |
| Business | €69 | 800 | Advanced 全部 + 冷邮件序列、LinkedIn+邮件多渠道、500 email credits/月 |

补充：全部档位 14 天免费试用；**Quarterly -20%、Yearly -50%**（页面 Tab 标注）；支持响应时长按档位分 48h / 4h / Priority；LinkedIn Inbox 为付费 add-on（500 条免费对话）。[L8]

#### 明显缺口

1. **邀请额度是硬天花板**：Pro 300/月、Advanced 与 Business 800/月，超出即停；额度直接绑定价，而不是按需购买。[L8]
2. **收件箱要额外买**：核心的对话管理不在订阅内，是 add-on。[L8]
3. **扩展形态限制**：依赖浏览器与登录态运行，电脑/浏览器不开就不跑；不是云端常开，也没有官方 VPS/托管方案。[L8][L9]
4. **email finder 额度偏低**（Pro/Advanced 仅 25/月），做邮件外呼要另配工具。[L8]
5. 只有 LinkedIn + 邮件；没有 FB/IG/X/TikTok/WhatsApp/微信等渠道；内容生产与发帖排期完全不做。[L9]
6. 多账号只是「多账号导入 + 团队工作区」，官网未承诺每账号独立代理/指纹（**推断**）。[L8][L9]

### 4.5 Dripify

**定位**：云端 LinkedIn + 邮件序列工具，把「序列、收件箱、保护、分析」打包，团队能力放在 Advanced。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 序列 | 无限 drip campaign、序列内无限步骤；LinkedIn 与邮件动作可混排，带延时与条件；预置模板；15+ 变量（功能导航称 20+，含 AI icebreaker）；Advanced 有 A/B 测试与 Evergreen leads（持续补线索） | [L10][L11] |
| 名单与数据 | Lead queue、导入名单、兼容所有 LinkedIn 账号类型；自带 Email Finder（成功找到并验证才扣 1 credit）、数据增强 30+ 属性、Email Verifier | [L10][L11] |
| 收件箱 | 全档位内置 Dedicated Inbox，可直接回复，不必跳回 LinkedIn | [L10] |
| 安全 | 云发送；与账号所在地一致的专属 IP；随机化时间、只在设定工作时段跑；自适应活动控制（按账号历史调节节奏）；每日上限 75 连接请求 / 100+ 私信 / 30 Sales Nav InMail / 200+ 主页浏览 / 50+ endorse·like·follow | [L10] |
| 团队 / 集成 | Advanced 起：团队管理、角色分配、团队绩效、去重、模板共享、统一订阅管理；Pro 起有 HubSpot 集成、Open API & MCP Server | [L10][L11] |

#### 定价档位差异

| 档位 | 月付 | 年付 | 关键差异 |
|---|---|---|---|
| Pro | $79/用户/月 | $59/用户/月 | LinkedIn + 邮件序列、无限 campaign、内置保护、分析报告、Dedicated Inbox、HubSpot 集成、Open API & MCP、100 email credits/月、24/7 支持 |
| Advanced | $99/用户/月 | $79/用户/月 | Pro 全部 + 团队管理、增强保护、线索标签、步骤级分析、A/B 测试、Evergreen leads |
| Enterprise | 定制 | — | Advanced 全部 + 专属 onboarding、专属技术支持、CSM |

补充：7 天免费试用（给 Advanced 功能、无需信用卡）；**1 席位 = 1 个 LinkedIn 账号**；10+ 席位或整合多个独立订阅需联系销售；email credits 每月 100 个（30 天有效、不滚存），加购价 $29/1k、$49/2k、$69/5k、$99/10k。[L10]

#### 明显缺口

1. **1 席位只能接 1 个 LinkedIn 账号**，多账号必须线性加席位；10+ 席位转人工报价，价格不透明。[L10]
2. **每日动作硬上限**（75 连接/天、100+ 私信/天），比部分竞品更保守，规模化要靠堆账号。[L10]
3. **团队能力后置**：角色、团队绩效、A/B、Evergreen 都要 Advanced；Pro 只适合单人。[L10]
4. **邮件额度薄**（100/月），冷邮件规模化要持续买 credit。[L10]
5. 只有 LinkedIn + 邮件；没有内容排期、没有其它社媒渠道、没有独立邮件营销平台能力。[L10][L11]
6. 云 SaaS，不提供本地部署；账号隔离只有「专属 IP + 行为模拟」，无浏览器指纹级隔离说明（**推断**）。[L10]

### 4.6 HeyReach

**定位**：按 sender（LinkedIn 账号）计费的代理商型外呼平台，用户席位不收费，强调多客户 workspace 隔离、白标与 AI/MCP 集成。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 序列 | 无限 campaign；Connect / Message / Follow / 语音消息 / Profile view；「If Connected」条件区分已连接与新线索；邮件多渠道通过 Instantly / Smartlead 原生集成（自己不发送邮件） | [L12] |
| 名单 | 不自建搜索/采集；名单来自 Clay、RB2B、Trigify 等集成、CSV/API；每 sender 含 100 enrichment credits（一次性额度，可加购） | [L12] |
| 收件箱 | Unified Inbox，跨所有 sender 统一管理 LinkedIn 消息，不用反复登录账号 | [L12] |
| 团队 / 代理商 | Workspaces + 权限：一个登录管理多客户，客户的 sender / lead / campaign 数据彼此隔离；**加用户、VA、客户不收费**，只按 sender 计费；Agency 档含白标（1 个）、1:1 onboarding、专属 Slack；Unlimited 档多品牌白标（$500/add-on）、迁移、优先支持 | [L12] |
| 安全 / 基础设施 | Growth 档每个 sender 配独立住宅代理；Agency/Unlimited 需 **自带代理**（BYO proxies），官方可另谈托管方案；每 sender 独立限额、按安全节奏跑 | [L12] |
| AI / API | API + Webhooks；MCP Server 可让 AI Agent 拆名单、建 campaign、按情绪打标回复并写回 CRM | [L12] |

#### 定价档位差异

| 档位 | 月付 | 季付（-10%） | 年付（-20%） | 含 sender 数 | 关键差异 |
|---|---|---|---|---|---|
| Growth | $79/sender/月 | $72/sender/月（$214/季） | $64/sender/月（$759/年） | 按需加 sender | 无限 campaign、全部 LinkedIn 动作、统一收件箱、多渠道集成、100 credits/sender、Workspaces、MCP；**每 sender 独立住宅代理** |
| Agency | $999/月 | $900/月（$2,698/季） | $800/月（$9,591/年） | 25 个（页面同时展示 50 个选项） | Growth 全部 + 1,000 credits、白标、代做 onboarding、专属 Slack、自带代理 |
| Unlimited | $2,999/月 | $2,699/月 | $2,399/月（$28,790/年） | 不限（公平使用上限 300） | Agency 全部 + 3,000 credits、多品牌白标（$500/add-on）、代做迁移、优先支持 |

补充：Growth（FAQ 里也称 Starter）提供 14 天免费试用（3 个 LinkedIn 账号，无需信用卡）；Agency / Unlimited 可申请 30 天免费试用；官方 FAQ 明确「只按 sender 收费，加团队成员/客户免费」。[L12]

#### 明显缺口

1. **不做线索采集/搜索**：没有站内搜索、抓取、访客识别，名单必须由外部工具（Clay/RB2B/Trigify）或 CSV 喂进来，等于要再买一套数据工具。[L12]
2. **成本随 sender 线性上涨**：50 个账号约 $3,950/月（$79×50，未计折扣）；Agency 档虽打包 25 个 sender，但单价仍高。[L12]
3. **邮件能力依赖第三方**（Instantly / Smartlead），没有原生邮件发送与投递管理。[L12]
4. **Agency/Unlimited 要自备代理**，基础设施成本与运维落到客户身上；Growth 才送住宅代理。[L12]
5. 只有 LinkedIn 单渠道；没有内容生产、排期发布、跨平台收件箱。[L12]
6. 无免费档；Growth 试用 14 天，Agency 以上需申请。[L12]

### 4.7 LinkedHelper

**定位**：桌面型 LinkedIn 自动化 + 轻 CRM，靠「不碰浏览器扩展、过 bot 检测、每账号独立数据空间」服务多账号团队与代理商。

#### 核心模块（官方页面口径）

| 模块 | 关键能力 | 来源 |
|---|---|---|
| 采集 / 名单 | 站内与组织页搜索（LinkedIn / Sales Navigator / Recruiter）；帖子点赞与评论者、1 度人脉、校友页、Sales Nav 名单、Recruiter 项目、待处理邀请、群组成员、活动参与者、公司员工；Auto-Collect 按计划持续拉新；CSV/TXT/HTML 导入 | [L13] |
| 序列 | 无限 campaign、30+ 动作类型、预置工作流模板、if-then-else 模板、Spintax、图片消息、Hyperise 个性化图片、活动/公司关注/群组邀请等批量动作；回复检测；跨 campaign 移动线索 | [L13] |
| AI | AI 个性化私信（生成后进草稿队列，可逐条或批量审核）、AI ICP Detection（读资料并按 ICP 打分）、AI Commenter、AI Reply Assistant、AI Message Generator、AI Text Editor；AI credits 按授权期一次性发放 | [L13] |
| CRM / 收件箱 | 内置 Linked Helper CRM：自定义备注、标签与自动标签、内置 Inbox；原生集成 HubSpot / Salesforce / Pipedrive / Zoho / ActiveCampaign / Close / Capsule / Streak / HighLevel / Instantly / Google Sheets；webhook / Zapier / Make / n8n | [L13] |
| 团队与隔离 | 每个客户/部门/项目独立 workspace，数据隔离、无权限的账号不可见；角色 Owner/Admin/Member/Guest；账号级权限 Owner/Manager/Editor/Viewer；客户可作为 Guest 只读；支持远程接管同事电脑上的账号、跨 workspace 迁移账号/授权/credits | [L13] |
| 安全 / 部署 | 桌面软件（非扩展）；官方称可通过 DataDome、Cloudflare、PerimeterX、Akamai、Imperva 检测；鼠标移动/打字/随机延时模拟；滚动 24h 智能限额；可用自有 IP 或自购代理（内置代理质量检测）；可跑在自购 VPS 上 | [L13] |

#### 定价档位差异

| 维度 | Standard | Pro |
|---|---|---|
| 价格 | 列表价 $15/授权/月；3 个月 -11%（$13.33/月）、6 个月 -33%、12 个月 -45%；本地存储年付低至 **$8.25/月/授权**，云存储低至 **$16.50/月/授权** | 同左（按授权数与期限叠加折扣） |
| 批量折扣 | 10 个 -10%、20 个 -20%、50 个 -30%、75 个 -35%、100 个 -40%、1000+ -50%（同一 Workspace 一次性购买） | 同左 |
| 每日动作 | 群组成员私信、活动参与者私信、带图消息、Hyperise 图片、活动/关注/群组邀请、点赞评论、CRM 推送、webhook 推送等**多为 20/天** | 官方侧**不限**（LinkedIn 侧仍有限制） |
| AI / 数据额度 | 250–1,500 AI credits（按期限）、620 data credits/月 | 500–3,000 AI credits、3,100 data credits/月 |
| 数据存储 | Local：数据只在本机，换设备需手工迁移；Cloud：自动备份、跨设备、账号间自动共享名单、支持 incoming webhooks | 同左 |

补充：14 天免费试用给 **Pro 全功能**、无每日上限、无需信用卡；同一个 Workspace 内每个 LinkedIn 账号都能开试用且共享同一结束日；官方明确「每个账号独立存储空间，数据不混」。[L13]

#### 明显缺口

1. **必须开着电脑/软件**（或自购 VPS），不是云端常开；Local 版换设备、共享数据都要手工。[L13]
2. **Standard 档 20/天的动作上限**很硬，实用场景基本倒逼上 Pro；Pro 的「不限」也只是官方侧不限，LinkedIn 侧仍会限。[L13]
3. **AI / 数据额度按期限一次性发放**，用完要买；电话号 10 credits/条、邮箱 1 credit/条，规模化采集成本不低。[L13]
4. **代理要自购**，官方只做质量检测；IP 成本与风控责任在用户。[L13]
5. 只有 LinkedIn；没有邮件序列、没有内容排期、没有其它社媒渠道。[L13]
6. 桌面架构对非技术团队不友好（安装、VPS、代理、备份都要自己管）。[L13]

### 4.8 横向结论：这一类的共性能力与结构性缺口（供第六章引用）

**共性能力（6 家都有）**：LinkedIn 加好友、私信序列、回复即停、限额/随机延时、名单导入、CSV 导出、CRM/Webhook 集成、按账号或席位订阅。

**结构性缺口（6 家都没做或只做了一半）**：

1. **全是 LinkedIn 单平台**。Expandi / Dripify / Waalaxy 的「多渠道」只是 LinkedIn 序列里插邮件；没有 FB / IG / X / TikTok / WhatsApp / 微信 / 小红书。对「一个外贸业务员同时管 LinkedIn + WhatsApp + 邮件 + 阿里国际站」的真实工作流，仍要拼 3–4 个工具。[L1]–[L13]
2. **没有内容生产与发布**。6 家都不做产品/SKU 库、素材库、多语言文案、内容日历、发帖排期与帖级指标；它们是「获客自动化」，不是「社媒工作台」。[L1]–[L13]
3. **多账号隔离停留在「权限 + 分区」层**。LinkedHelper 有每账号独立数据空间与账号级权限，Expandi / HeyReach 有 workspace 按客户隔离，但都不提供「每账号独立浏览器指纹 + 独立出口 IP + 冷却/熔断」的运行时隔离；代理要么自购（LinkedHelper、HeyReach Agency+），要么只在 Growth 档赠送（HeyReach）。[L7][L12][L13]
4. **收件箱只覆盖 LinkedIn**。Waalaxy 的 Inbox 还要额外买；没有跨 WhatsApp / 邮件 / IG DM 的统一会话、意图分类与 SLA。[L2][L8][L12]
5. **CRM 是名单级，不是贸易闭环**。阶段/标签/备注/导出为主，没有报价单、样品、订单、展会名单、成交归因；Dux-Soup、Dripify 明确靠外部 CRM 承接。[L4][L10]
6. **AI 只做文案个性化**。Dux-Soup 用 LLM 判定回复，LinkedHelper 有 ICP 检测/评论/回复助手，但没有「多语种（英/西/阿/葡/俄/德）内容生产 + 询盘意图分类 + 人工审批闸门 + 品牌词表」的组合。[L2][L13]
7. **计费结构性空档**：按 seat / sender / 授权线性计价，多账号团队成本随账号数上涨（HeyReach 50 账号 ≈ $3,950/月；Expandi 10+ 席位转人工报价）；年付折扣普遍很大（Waalaxy -50%、LinkedHelper -45%、Dux-Soup/HeyReach -20~25%），说明标价留了较大议价空间（**推断**）。没有一家做「内容 + 获客 + CRM」的打包价。[L1][L5][L8][L12][L13]
8. **合规风险由用户承担**：各家页脚均声明与 LinkedIn 无关联（Expandi、HeyReach 等），账号被封风险自担；产品能力集中在「模拟人类 + 限额」，没有「官方 API 优先 + 会话兜底 + 审批闸门 + 熔断」的工程化方案。[L5][L12]

### 来源（访问日期均为 2026-10-25）

- [L1] Dux-Soup / STACKED Pricing — https://www.dux-soup.com/pricing
- [L2] Dux-Soup Inbox & replies — https://www.dux-soup.com/product/features/inbox-replies
- [L3] Dux-Soup Drip campaigns — https://www.dux-soup.com/product/features/drip-campaigns
- [L4] Dux-Soup Lead management — https://www.dux-soup.com/product/features/lead-management
- [L5] Expandi Pricing — https://expandi.io/pricing/
- [L6] Expandi LinkedIn Outreach — https://expandi.io/linkedin-outreach/
- [L7] Expandi Workspaces — https://expandi.io/workspaces/
- [L8] Waalaxy Pricing — https://www.waalaxy.com/en/pricing/
- [L9] Waalaxy 首页（产品导航与团队/收件箱说明）— https://www.waalaxy.com/en/
- [L10] Dripify Pricing（含 FAQ 与完整功能对比）— https://dripify.io/pricing/
- [L11] Dripify 功能导航（LinkedIn Lead Generation / Multichannel / Email Finder / Data Enrichment / Email Verifier / Inbox / Team Management）— https://dripify.io/（导航来源）
- [L12] HeyReach Pricing（含 FAQ：sender 定义、代理、试用、白标）— https://www.heyreach.io/pricing/
- [L13] LinkedHelper Pricing（含 Local/Cloud 对照、Standard/Pro 功能表、试用 FAQ）— https://www.linkedhelper.com/pricing/
<!-- SECTION:i25-linkedin END -->
