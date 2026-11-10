# Postiz 接入指南（Packrivo 社媒工作台）

---



---

> 一句话：**别自建。订阅 Postiz 云版，工作台里填 `https://api.postiz.com` + 一个 API Key 就通**——Meta / X / TikTok / YouTube 的开发者 App 全由 Postiz 那边代办，你一个都不用申请。
> 现在真能发的是：Bluesky（已实测真发公开帖）。媒体上传管线（`POST /public/v1/upload`）本轮已接通并隔离实测通过；买到 key、通道授权好之后，Instagram / TikTok / YouTube / Pinterest **只要有配图就能发**。
> 价格、档位、限流口径都是 2026-11-09 现场从 postiz.com/pricing 与 api.postiz.com 读回来的，见 §1、§2；不要凭记忆改。

---



---

## 1. 结论：买云版，不自建

| | 自建（docker compose） | **云版（api.postiz.com）** |
|---|---|---|
| 装好要多久 | 40–90 分钟，还要自己升级镜像 | 订阅 + 复制 key，10 分钟 |
| 平台授权 | **要自己申请 Meta / X / TikTok 开发者 App**，把 Client ID/Secret 填进 compose 的 env | Postiz 云侧已备好全部 App，你在网页里点 OAuth |
| 回调地址 | 必须公网可达，本机自建得挂 cloudflared / ngrok | 不用管 |
| 价格 | 免费，但要付服务器成本 + 你的时间 | $29 / $39 / $49 / $99 每月，见下表 |
| 公开 API 额度 | 自己定（`API_LIMIT` 默认 90） | **建帖端点每小时 90 次**（云版官方口径，见 §2.7） |
| 适合 | 想改 Postiz 源码、数据不出内网 | 只想发帖，不想碰任何开发者后台 |

**你选的是云版。** 理由很直接：自建真正贵的不是钱，是「每个平台都要你自己去申请开发者资质、审核、配回调」；云版把这一步整个外包了。

### 1.1 买哪一档（2026-11-09 官方价格，来源 docs.postiz.com/cloud/plans + postiz.com/pricing）

| 档位 | 月付 | 年付 | 通道数 | 够不够你用 |
|---|---|---|---|---|
| Standard | $29/mo | $278/年 | 5 | **够**：IG + Facebook Page + X + TikTok + Pinterest 正好 5 个 |
| Team | $39/mo | $374/年 | 10 | 想再加 YouTube / LinkedIn / Threads 就跳到这个 |
| Pro | $49/mo | $470/年 | 30 | 多账号矩阵、多客户 |
| Ultimate | $99/mo | $950/年 | 100 | 代运营级别 |

三档共同点（原文口径）：**所有档位都包含 MCP server、CLI 和 API**；发帖数不限；有 7 天免费试用（`Start for $0`）。所以「API 要不要另外加钱」这个顾虑不存在——API 不是加价项。

**建议**：先用 7 天试用买 Standard（$29），接 IG + FB Page + X 三个通道跑通，确认工作台这边发得出去，再决定要不要升 Team 加 YouTube。

---

## 2. 云版接入：照做三十分钟

### 2.1 订阅

`https://postiz.com/pricing` → 选 Standard（$29/mo）→ 注册。试用期不扣款，但**试用也一样要填卡**，这是他们的流程，与工作台无关。

### 2.2 在 Postiz 里接通道

登录 `https://app.postiz.com` → 左侧 `Channels` / 「添加通道」→ 选平台 → 点授权。

- 全程 OAuth，**你不会看到任何开发者后台**；
- 每接一个占一个通道额度（Standard 5 个），接错了可以删了重接，额度回收；
- 接完在 Postiz 里能看到通道卡片，这就是工作台 `GET /integrations` 要读到的东西。

### 2.3 复制 API Key

`Settings` → `API Keys`（部分版本菜单叫 `Developers`）→ 新建 / 复制。

- key 是 64 位串，**只显示一次**，先粘到记事本；
- 工作台只存加密后的密文，界面上永远只回显尾 4 位 `…xxxx`，别指望再从工作台里读出来。

### 2.4 回工作台填两项

设置页：

1. 点 **「云版」** 按钮（或手填 Base URL `https://api.postiz.com`）——后端会自动补成 `https://api.postiz.com/public/v1`，你填裸域名就行；
2. API Key 粘进去 → 保存 → 点 **验证**。

### 2.5 验证通过长什么样

```
ok: true, count: N, matched: { instagram: "int_xxx", x: "int_yyy", … }
```

`matched` 里出现的平台，平台页那一行就变 `已跑通`，并带上 Postiz 侧的通道名。没出现的按 §3 状态表读原因。

### 2.6 发第一条

建内容 → 配图（图库生成或上传）→ 建排期 → `立即跑`。发布成功必须满足两条：HTTP 2xx **且** 回包里有 `postId`；只有 2xx 没有 id 会被判成 `upstream_error`（不拿本地随机串冒充平台 id）。

### 2.7 云版的两条硬约束（实测，不是文档抄的）

| 约束 | 官方口径（docs.postiz.com，2026-11-09 读回） | 工作台怎么处理 |
|---|---|---|
| 限流 | **建帖端点 `POST /public/v1/posts` 每小时 90 次**（cloud/limits 页口径；intro 页括号写「100 for the cloud」，两处有一字差，见下方未确认项）。只作用于 create-post，`/integrations`、`/upload` 不计入；单实例全局值，不分档；单请求可批量带多条帖 | 云版通道列表缓存 10 分钟；429 进冷却，读 `retry-after` 至少 60 秒，冷却期内不再打网络，平台页显示「还要等 N 分钟」 |
| 鉴权 | 头名 `Authorization`，值是**裸 key，不要 `Bearer`** | 无 key → `401 {"msg":"No API Key found"}`；key 无效 → `401 {"msg":"Invalid API key"}`。两种都被判 `pending_credential`（「已连通，但 key 不对」），只有真正连不上才报 `pending_connect` |

**未由实测确认的项（本轮无有效 key，未 live 触发 429）**：① 云版真实额度是 90 还是 100（官方两页口径不一致）；② 统计窗口精确边界（滚动/整点，官方未文档化）；③ 429 是否真带 `retry-after` 头（官方未承诺）。这三条买到 key 后需实测钉死，不要当已确认写进对外口径。

额度怎么够用：发一条带图的帖子是 2 次（`/upload` + `/posts`，其中 `/upload` 不计入 90 次额度），通道刷新被缓存压到 6 次/小时以内 → **每小时仍能发几十条**。

---

## 3. 平台页的状态怎么读

界面上的标签全部来自后端 `channel_state` 字段，一共 10 种：

| 界面文字 | `channel_state` | 含义 / 下一步 |
|---|---|---|
| 已跑通 | `ready` | 有证据能发。Bluesky 是实测真发；Postiz 通道是 `GET /integrations` 真读到了这个平台 |
| 本地模拟 | `local_sim` | `mock`，只写本地库，不算发布 |
| 填配置即通 | `pending_config` | 缺 Token / 实例域名 / 接收端 URL，填完就能发 |
| **待填 Key** | `pending_credential` | **Postiz 已连通，但 API Key 无效或已撤销**（`401 Invalid API key` / `新账号没 key`）；也可能是 429 冷却中。去 Postiz → Settings → API Keys 重新复制 |
| 待 Postiz 联调 | `pending_postiz` | Postiz 通了，但这个平台没在 Postiz 里授权通道 |
| 服务没连上 | `pending_connect` | 请求没到上游（DNS / 端口 / 反代 404 / 超时）。云版填 `api.postiz.com` 时这基本只能是本机网络问题 |
| **缺素材** | `pending_media` | 平台只收图文/视频，这条内容没有配图 |
| 待平台资质 | `pending_api` | 平台侧要开发者审核/付费档。走云版时这层由 Postiz 代办 |
| 需浏览器会话 | `pending_session` | 只能靠 cookie 会话，不能 API |
| 只能人工 | `manual_only` | 平台没有公开接口 |

`pending_credential` 是本轮新拆出来的：上一版把 401 也报成「服务没连上」，会让人去查端口和 docker——方向完全错，云版根本没有端口可查。现在 401 与真连不上是两条路径、两句提示。

> **授权到底在哪做**：不在工作台做。工作台这一侧只负责「拿 API Key 调 `/posts`」；连 Facebook / Instagram / X / TikTok 这些账号、走 OAuth、填 `privacy_level` 之类的，全在 Postiz 自己的网页端 `https://platform.postiz.com` → **Channels**。平台表右侧那九个「去 Postiz 授权」按钮就指向那里（未登录会先被 307 送到 `/auth`）。也就是说：**Key 对了，平台表也只能读到「Postiz 里已经连了哪些」**，工作台没法替你连账号。

---

## 4. 自建步骤（备用路径：只有数据不能出内网时才走这条）


### 4.1 装 Docker

```powershell
winget install --id Docker.DockerDesktop -e
```

装完重启，确认：

```powershell
docker version
docker compose version
```

本机当前**没装 docker**（前几轮核对过），这一步必须你手动过一遍。

### 4.2 取仓库并起 compose

```powershell
cd E:\破甲工作区
git clone https://github.com/gitroomhq/postiz-app.git
cd postiz-app
```

官方 `docker-compose.yaml` 里所有配置都直接写在 `environment:` 段，**不需要 `.env`**。要改的只有下面几项（用编辑器改 `docker-compose.yaml`）：

| 变量 | 默认值 | 改成 | 为什么 |
|---|---|---|---|
| `JWT_SECRET` | 一句英文示例 | 一段随机字符串（40+ 字符） | 必改，登录态签名密钥 |
| `MAIN_URL` | `http://localhost:4007` | 你的访问地址 | 回调地址与邮件链接都按它拼 |
| `FRONTEND_URL` | `http://localhost:4007` | 同上 | |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4007/api` | 同上 + `/api` | 前端调后端 |
| `DATABASE_URL` | `postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local` | 不用动 | compose 里的 postgres 容器 |
| `REDIS_URL` | `redis://postiz-redis:6379` | 不用动 | |
| `BACKEND_INTERNAL_URL` | `http://localhost:3000` | 不用动 | |
| `STORAGE_PROVIDER` | `local` | 保持 `local` | 上传的图/视频落 `postiz-uploads` 卷 |
| `UPLOAD_DIRECTORY` / `NEXT_PUBLIC_UPLOAD_DIRECTORY` | `/uploads` | 不用动 | 工作台将来调 `/upload` 时要对得上 |
| `DISABLE_REGISTRATION` | `false` | 注册完第一个账号后改成 `true` | 否则谁都能注册你的实例 |
| `API_LIMIT` | `30` | 先不动；被限流再调 | 公开 API 每分钟请求上限 |

**默认端口是 4007**（`MAIN_URL` 三处一起改才会变）。
注意：工作台里现在存着的 `postiz_base = http://127.0.0.1:5000` 是早期假设值，装好之后要改成 `http://127.0.0.1:4007`（或你的实际地址）。

### 4.3 起容器

```powershell
docker compose up -d
docker compose ps
docker compose logs -f postiz
```

首次拉镜像约 2–4 GB。`postiz` 容器 `Up` 之后浏览器开 `http://localhost:4007`，注册第一个账号（**这个账号就是实例管理员**）。

### 4.4 在 Postiz 里接平台

Postiz 后台左侧 `Channels` → `Add channel` → 选平台 → OAuth 授权。
**但每个平台都要先在 compose 的 env 里填好开发者 App 凭据**，否则点授权只会跳到平台报错页：

| 平台 | compose 里要填 | 平台侧还要什么 | 工作台现在能发吗 |
|---|---|---|---|
| Facebook Page | `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Meta 开发者 App + `pages_manage_posts`、`pages_read_engagement`，App 审核（Advanced Access）；回调域名加你的 `MAIN_URL` | ✅ 纯文本可发 |
| Instagram | 同上（走同一 Meta App） | 专业号（Business/Creator）+ `instagram_content_publish`；**必须带图/视频** | ⛔ 差素材上传（§6） |
| X | `X_API_KEY` / `X_API_SECRET` | X API 发帖要付费档（免费档只能读） | ⛔ 差付费档 |
| TikTok | `TIKTOK_CLIENT_ID` / `TIKTOK_CLIENT_SECRET`（企业号另有 `TIKTOK_BUSINESS_*`） | 内容发布 API 需申请审核；**必须带视频** | ⛔ 差审核 + 素材 |
| YouTube | `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | Google Cloud OAuth + YouTube Data API 配额；**必须带视频** | ⛔ 差素材 |
| Pinterest | `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET` | 必须带图 + 指定 `board` id（工作台侧 `postiz_settings` 里填） | ⛔ 差素材 |
| LinkedIn | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn 开发者 App + `w_member_social` | ✅ 纯文本可发 |
| Reddit | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | 必须指定 subreddit（`postiz_settings.reddit.subreddit`） | ✅ 带 subreddit 可发 |
| Discord / Slack | `DISCORD_*` / `SLACK_*` | 必须指定 channel id | ✅ 带 channel 可发 |
| Mastodon | `MASTODON_URL` / `MASTODON_CLIENT_ID` / `MASTODON_CLIENT_SECRET` | 实例里建 App 拿凭据 | ✅ 但**不用绕 Postiz**：工作台自带 Mastodon 直连（填 token 即可），见 §7 |
| Telegram / Bluesky | — | — | ✅ **不走 Postiz**：工作台直连，Bluesky 已实测真发成功 |

### 4.5 拿 API Key

Postiz 后台 `Settings` → `Developers`（Public API）→ 复制 key。
自建实例的 key 只在你这台机器上，别贴到聊天/issue 里。

### 4.6 回工作台填两项

工作台 → 设置 → 外部对接：

| 字段 | 填什么 | 坑 |
|---|---|---|
| Postiz Base URL | `http://127.0.0.1:4007` | 后端自动补 `/api/public/v1`，**别自己写成 `.../api/public/v1`**（写了也能识别，但没必要）；写 `http://host:4007/api` 也能识别 |
| Postiz API Key | 上一步的 raw key | **不要加 `Bearer `**，Postiz 公开 API 认裸 key。工作台里存的是 AES-256-GCM 加密列，页面上只回显 `…后四位` |
| postiz_type | `now`（立刻发）/ `schedule`（交给 Postiz 排期） | 选 `schedule` 时排期必须有 `run_at` |

保存后点 **验证**。返回结构：

```json
{ "ok": true, "base": "http://127.0.0.1:4007/api/public/v1", "key_hint": "…ab12",
  "count": 2,
  "integrations": [ { "id": "clx…", "identifier": "facebook", "name": "Packrivo", "disabled": false } ],
  "matched": { "facebook_page": { "id": "clx…", "identifier": "facebook" } },
  "unmatched": ["tiktok", "youtube", "pinterest", "…"] }
```

`matched` 里出现的平台，平台页的状态会从 `待 Postiz 联调` 变成 **`已跑通`**（`state_note` 显示 `Postiz 已授权：<通道名>`）。
`unmatched` 就是「Postiz 通了、但这个平台还没接账号」。

### 4.7 命令行先验一遍（不经过工作台）

```powershell
curl.exe -s -H "Authorization: <raw-key>" http://127.0.0.1:4007/api/public/v1/integrations
```

期望：JSON 数组，每项含 `id` / `identifier` / `name` / `disabled`。
返回 `401` → key 错；`404` → 路径少了 `/api/public/v1` 或实例没起；连不上 → 容器没起来，`docker compose logs postiz` 看。

---

## 5. 一次多账号 / 通道钉死


同一平台在 Postiz 里接了多个账号时，平台页会挑第一个匹配到的。要指定用哪个，用设置项 `postiz_integration_map`（JSON，键=工作台平台 code，值=Postiz integration id）：

```json
{ "facebook_page": "clx111…", "instagram": "clx222…" }
```

工作台读取顺序（`app/postiz.mjs:195-208`）：先查 map 里钉死的 id，命中即用；否则按平台候选 identifier 列表找第一个未停用的通道。

---

## 6. 素材上传：已接通（IG / TikTok / YouTube / Pinterest 的闸门）

上一版文档这里写的是「管线没接」，**本轮已经补完并隔离实测通过**：

| 环节 | 实现位置 | 实测证据 |
|---|---|---|
| 先传图拿 id | `app/postiz.mjs` `uploadMedia()` → `POST {base}/upload`，multipart 字段名 `file`，图片走 `Blob`；单文件上限按官网：**图片 10 MB / 视频 1 GB**，`/posts` 请求体 50 MB | 假 Postiz 收到 `POST /api/public/v1/upload`，原始报文含 `name="file"` 与 `content-type: image/png` |
| 再带进发帖 | `publish()` 把 `content.image_path` 传成 `image: [{ id, path, alt }]`，`alt` 取 `image_alt`，缺省用标题，截到 1000 字符 | `posts[0].value[0].image = [{"id":"upl-1","path":"https://uploads.test/upl-1.png","alt":"gold sample set"}]` |
| 同一张图不重传 | 进程内 `uploadCache`（按路径 + mtime） | 同一内容连发两次，`/upload` 调用次数仍是 1 |
| 该拦的仍拦 | `MEDIA_REQUIRED = instagram / instagram-standalone / tiktok / youtube / pinterest`，命中且无图 → 抛 `pending_media`，界面显示 `缺素材` | IG 无图被拦；X 无图正常发，`image: []` |
| 上游出错不吞 | 上传回包缺 `id`/`path` → 抛 `upstream_error`，不拿本地路径冒充 | — |

所以现在只剩一条前提：**内容的 `image_path` 指向一张真图**。素材来源三条，都在工作台里：

1. 图库生成（`image-gen` 相关路由写回 `content.image_path`）；
2. 批量补图（`ops/` 里的一次性脚本已跑过，库里 27 MB 现成素材）；
3. 产品行带图 → 建内容时自动复制过去。

素材落在 `data/media/`；`GET /api/media/<文件名>` 走 `app/server.mjs:21` 的 `MEDIA_DIR = path.join(DATA_DIR, 'media')`，跟着 `SWB_DATA` 走（P3-21 已修，`probe-media-dir.mjs` 起 8805 隔离实例 6/6 PASS：临时目录里的图 200、真实 `data/media` 独有的图 404、穿越请求 404）。

---

## 7. 不用等 Postiz 就能发的四条


| 通道 | 现在状态 | 要补什么 |
|---|---|---|
| Bluesky | ✅ 已实测真发（`packrivo.bsky.social`，demo 帖可公开访问） | 无 |
| Mastodon | 差 token | Mastodon 实例 → 首选项 → 开发 → 新建应用（勾 `write:statuses`）→ 拿 access token；工作台账号里填 instance + token |
| Telegram | 差 bot token + chat id | BotFather 建 bot；`getUpdates` 拿 `chat.id`；工作台账号里填 |
| Webhook | 差 URL | 任意接收端；payload 必须回 `{"id"|"post_id"|"postId"}` 之一，空 `{}` 会被判 `upstream_error`（P1-38） |

这四条填完即为 `已跑通`，可以当天就开始发内容——**这是当前最快的产出路径**，不依赖 Postiz。

---

## 8. 本轮实测证据（2026-11-09）


隔离实例（`SWB_PORT=8803` + live 库快照 `VACUUM INTO`）+ 假 Postiz（`127.0.0.1:5077`，模拟 `GET /integrations` 与 `POST /posts`），脚本 `E:\破甲工作区\.tmp\audit\postiz-e2e-8803.mjs`，`ALL_OK=true`、`[exit=0]`：

```
A_postiz_status = {"base":"http://127.0.0.1:5077/api/public/v1","configured":true,"hint":"…1109"}
B_verify_matched = ["x","facebook_page","instagram"]
C_platform_states = {
  "facebook_page":{"state":"ready","note":"Postiz 已授权：Packrivo FB Page"},
  "instagram":{"state":"ready","note":"Postiz 已授权：packrivo.ig"},
  "x":{"state":"pending_api","note":"付费档才有发帖额度"},
  "tiktok":{"state":"pending_postiz","note":"Postiz 通了，但没有这个平台的已授权通道"},
  "bluesky":{"state":"ready","note":"文字 + 链接卡片…"},
  "mock":{"state":"local_sim","note":"把发布结果写进本地库…"}}
D_publish = [{"ok":1,"channel":"postiz","platform":"facebook_page","post_id":"pzp-fake-1","url":"http://localhost:5077/p/pzp-fake-1"}]
E_fake_calls = ["GET /api/public/v1/integrations auth=pz-fake-key-20261109",
                "GET /api/public/v1/integrations auth=pz-fake-key-20261109",
                "POST /api/public/v1/posts auth=pz-fake-key-20261109"]
```

读法：

- 通道存在 → `ready` 并带上 Postiz 侧的通道名；**不是「配了 key 就报 ready」**，要先真探到 `/integrations`；
- 通道不存在 → `pending_postiz`（区分于 `pending_api`：那是平台资质问题，不是没接账号）；
- `mock` 恒为 `local_sim`，不会被算成已发；
- 发布走 `POST /posts` 拿到 `postId` 才算成功，`publish_result.ok=1` + 平台 id + url 全部落库；
- 假 Postiz 收到的 `Authorization` 是**裸 key**（无 `Bearer`），与 §4.6 一致。

同一套逻辑在真机上就是：`docker compose up` → Postiz 里接 Facebook Page → 工作台填 `http://127.0.0.1:4007` + key → 平台页那行变 `已跑通` → 建内容 → 建排期 → 真发出去。

---

## 9. 云版 + 上传实测（2026-11-09 补）

### 9.1 云版 API 的真实形状（无 key 打的）

| 探测 | 结果 | 结论 |
|---|---|---|
| `GET https://api.postiz.com/public/v1/integrations` 不带 Authorization | `401 {"msg":"No API Key found"}` | 端点存在 |
| 同上，带假 key（裸 / `Bearer` 都试） | `401 {"msg":"Invalid API key"}` | 鉴权头就是裸 key，不加 `Bearer` |
| `POST /public/v1/upload`、`POST /public/v1/posts` 带假 key | 同样 401（不是 404） | 两条写接口都在 |
| 往返延迟 | 296–1444 ms | 本机网络到 Postiz 云正常，不用挂代理 |

### 9.2 发布链路隔离实测（`SWB_PORT=8803` + 假 Postiz `127.0.0.1:8804` + live 库快照）

脚本 `E:\破甲工作区\.tmp\audit\e2e-cloud-upload.mjs`，**26 条断言全过，`ALL_OK=true`、`[exit=0]`**：

```
PASS base 归一化 = http://127.0.0.1:8804/api/public/v1
PASS 自建 base → cloud=false / 自建 TTL 60s / 初始无冷却
PASS verify 拿到 2 个通道 / 匹配到 instagram
PASS 鉴权用裸 Authorization（无 Bearer）
PASS 带图发布成功 post_id=pz-1 url=https://postiz.test/p/pz-1
PASS /upload 被调用 1 次 / multipart 字段名是 file / 上传 part 带 image/png
PASS image 用上传返回的 id/path：[{"id":"upl-1","path":"https://uploads.test/upl-1.png","alt":"gold sample set"}]
PASS type=now + date=… / settings.__type=instagram / post_type=post
PASS 二次发布不再重复上传，upload 次数仍 1
PASS IG 无图被拦 errorClass=pending_media
PASS X 无图可发，image 是空数组
PASS 429 抛 rate_limited：Postiz 限流（HTTP 429）：云版建帖端点 90 次/小时，冷却 2 分钟后自动恢复
PASS 冷却已记录 cooldown_left_ms=90000
PASS 冷却期内直接短路 / 短路没有新增网络请求（calls 6 → 6）
PASS status 暴露 cooldown_ms=89999
PASS /integrations 只打了 2 次（首探 + 429），缓存生效
```

### 9.3 线上 8795 的平台行（真库，无 key 状态）

```
facebook_page | pending_credential | Postiz 已连通，但 API Key 无效（去 Postiz → Settings → API Keys 复制）：Postiz 拒绝鉴权（HTTP 401）
instagram     | pending_credential | （同上）
tiktok        | pending_credential | （同上）
pinterest     | pending_credential | （同上）
x             | pending_credential | （同上）
youtube       | pending_credential | （同上）
linkedin      | pending_credential | （同上）
threads       | pending_credential | （同上）
reddit        | pending_credential | （同上，接好后建帖要带 subreddit）
bluesky       | ready              | 已实测真发
telegram/mastodon/email/webhook | pending_config | 填 Token / URL 即通
quora         | manual_only        | 无公开接口
mock          | local_sim          | 只写本地库
```

这张表说明本轮修复已经落在线上：同一套代码换成真 key，那四行的 `pending_credential` 会直接翻成 `ready`（通道已授权时），或者翻成 `pending_postiz`（key 对但没接那个平台）——不会再出现「让你去查 5000 端口」这种误导。

### 9.4 与上一版文档的差异

- 上一版把「服务没连上」当万能桶，并且默认 `http://127.0.0.1:5000` 自建；现在默认 `https://api.postiz.com`，`5000` 只出现在自建备用路径里；
- 上一版说媒体上传「没接」；现在接了，并且有 26 条断言兜着；
- 上一版没有价格与额度口径；现在写死了档位价与额度上限。**额度口径本轮已更正**：官方建帖端点每小时 90 次（不是早期误写的「30 次」；「30」实为自建 compose 的 `API_LIMIT` 默认值），见 §2.7。
