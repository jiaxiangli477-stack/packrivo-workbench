# Postiz 公开 API v1 · 契约速查（工作台发布中心用）

来源：`gitroomhq/postiz-docs` 仓库 `public-api/openapi.json` + `public-api/posts/create.mdx`
取样时间：2026-10-26。自建版本若有差异，以你装的 Postiz 版本内的 `apps/backend/src/public-api/` 为准。

## 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/integrations` | 列出所有已接通道（id / identifier / name / profile / disabled / customer） |
| POST | `/posts` | 建帖（now / schedule / draft） |
| GET | `/posts` | 列帖，`startDate`、`endDate` 必填（ISO），可选 `customer` |
| PUT | `/posts/{id}/status` | 改状态 |
| DELETE | `/posts/{id}` | 删帖 |
| POST | `/upload` | 上传媒体（multipart，字段名 `file`） |
| POST | `/upload-from-url` | 按 URL 收媒体 |
| GET | `/analytics/{integration}` · `/analytics/post/{postId}` | 平台/单帖数据 |
| GET | `/me` | 当前组织/账号 |
| GET | `/find-slot/{id}` | 下一个空档 |

## Base URL

- 自建：`http://<host>:<port>/api/public/v1`
- 官方云：`https://api.postiz.com/public/v1`

## 鉴权

```
Authorization: <api key>
```

裸 key，不加 `Bearer`。Postiz 后台 → Settings → API 生成。

## 建帖请求体

```json
{
  "type": "now | schedule | draft",
  "date": "2026-10-26T02:09:39.000Z",
  "shortLink": false,
  "tags": [],
  "posts": [
    {
      "integration": { "id": "<integration id>" },
      "value": [{ "content": "正文", "image": [] }],
      "settings": { "__type": "x", "who_can_reply_post": "everyone" }
    }
  ]
}
```

- `type=now` 忽略 `date`；`schedule` 用 `date`；`draft` 只存不发。
- `value` 是数组：多段 = 线程/轮播。
- `image` 里的对象是 `/upload` 返回的 `{ id, path }`，可选 `thumbnailTimestamp`（毫秒，IG/TikTok 封面）。

## 各平台 settings（只列工作台用到的）

| 平台 | `__type` | 必填 |
|---|---|---|
| X | `x` | `who_can_reply_post`（everyone/following/mentionedUsers/subscribers/verified），可选 `community`、`made_with_ai`、`paid_partnership` |
| LinkedIn 个人 | `linkedin` | — |
| LinkedIn 公司页 | `linkedin-page` | —（可选 `post_as_images_carousel`、`carousel_name`） |
| Facebook 主页 | `facebook` | —（可选 `url`、`post_type`=post/story） |
| Instagram | `instagram` / `instagram-standalone` | `post_type`=post/story |
| Threads / Mastodon / Bluesky / Telegram / Nostr / VK | 同名 | 只需 `__type` |
| TikTok | `tiktok` | `privacy_level`、`duet`、`stitch`、`comment`、`autoAddMusic`、`brand_content_toggle`、`brand_organic_toggle`、`content_posting_method` |
| YouTube | `youtube` | `title`（2-100 字）、`type`（public/unlisted/private）；可选 `selfDeclaredMadeForKids`、`tags`、`thumbnail` |
| Pinterest | `pinterest` | `board`（board id）；可选 `title`、`link`、`dominant_color` |
| Reddit / Lemmy | `reddit` / `lemmy` | `subreddit[]`，每项 `{value:{subreddit,title,type:"self",url,is_flair_required,flair}}` |
| Discord / Slack | 同名 | `channel`（channel id） |
| Medium / Dev.to / Hashnode / WordPress | 同名 | 标题类字段（`title` 等） |

TikTok 的 `content_posting_method` 只有 `DIRECT_POST` 是真发布；`UPLOAD` 只是把素材丢进 App 收件箱，24 小时内不同手就作废。

## 媒体限制

Instagram / TikTok / Pinterest / YouTube 没有图或视频发不出去。必须先把素材 `POST /upload` 拿到 `{id, path}` 再放进 `value[].image`。
工作台当前没有这条路（`pending_media` 拦截），接的时候加上传再放开。

## 常见错误

| HTTP | 含义 | 工作台归类 |
|---|---|---|
| 401/403 | key 不对或已撤销 | `pending_config` → blocked |
| 404 | 路径错（Base 少了 `/api/public/v1`） | `pending_config` → blocked |
| 400 | settings 缺字段 / 内容不合规 | `upstream_error` → 重试 3 次后 failed |
| 429 | 限流 | `rate_limited` → 退避重试 |
