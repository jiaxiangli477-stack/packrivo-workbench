import { DatabaseSync } from 'node:sqlite';
import { ROOT, DATA_DIR, DB_PATH } from './paths.mjs';
import { encrypt, decrypt } from './crypto.mjs';
import { SECRET_KEYS, maskSecret } from './secrets.mjs';

export { ROOT, DATA_DIR, DB_PATH };

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
create table if not exists setting (k text primary key, v text not null);

create table if not exists account (
  id integer primary key autoincrement,
  platform text not null,
  handle text not null,
  display_name text not null default '',
  profile_url text not null default '',
  kind text not null default 'business',
  status text not null default 'active',
  proxy text not null default '',
  fingerprint_dir text not null default '',
  session_state text not null default 'unknown',
  note text not null default '',
  created_at text not null default (datetime('now')),
  unique (platform, handle)
);

create table if not exists credential (
  id integer primary key autoincrement,
  owner_kind text not null,
  owner_id integer not null,
  field text not null,
  cipher text not null,
  hint text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists model_endpoint (
  id integer primary key autoincrement,
  name text not null,
  kind text not null default 'text',
  base_url text not null,
  model text not null,
  api_key_cipher text not null default '',
  key_hint text not null default '',
  priority integer not null default 100,
  enabled integer not null default 1,
  last_ok_at text,
  last_error text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists product (
  id integer primary key autoincrement,
  sku text not null unique,
  name text not null,
  selling_points text not null default '',
  params text not null default '',
  target_markets text not null default '',
  keywords text not null default '',
  url text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists asset (
  id integer primary key autoincrement,
  product_id integer references product(id) on delete set null,
  kind text not null default 'image',
  path text not null,
  sha256 text not null default '',
  tags text not null default '',
  source text not null default 'upload',
  created_at text not null default (datetime('now'))
);

create table if not exists hotspot (
  id integer primary key autoincrement,
  platform text not null,
  kind text not null default 'post',
  keyword text not null default '',
  url text not null default '',
  author text not null default '',
  title text not null default '',
  published text not null default '',
  snippet text not null default '',
  stats text not null default '{}',
  structure text not null default '{}',
  score real not null default 0,
  score_type text not null default 'manual',
  source text not null default 'manual',
  captured_at text not null default (datetime('now'))
);

create table if not exists content (
  id integer primary key autoincrement,
  parent_id integer references content(id) on delete set null,
  product_id integer references product(id) on delete set null,
  hotspot_id integer references hotspot(id) on delete set null,
  account_id integer references account(id) on delete set null,
  platform text not null,
  lang text not null default 'en',
  title text not null default '',
  body text not null,
  hashtags text not null default '',
  utm_url text not null default '',
  status text not null default 'draft',
  model text not null default '',
  similarity real,
  created_at text not null default (datetime('now')),
  approved_at text
);

create table if not exists review (
  id integer primary key autoincrement,
  content_id integer not null references content(id) on delete cascade,
  reviewer_kind text not null default 'ai',
  decision text not null,
  score integer not null default 0,
  notes text not null default '',
  at text not null default (datetime('now'))
);

create table if not exists schedule (
  id integer primary key autoincrement,
  content_id integer not null references content(id) on delete cascade,
  account_id integer not null references account(id) on delete cascade,
  channel text not null default 'auto',
  run_at text not null,
  state text not null default 'pending',
  retry integer not null default 0,
  last_error text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists publish_result (
  id integer primary key autoincrement,
  schedule_id integer references schedule(id) on delete set null,
  content_id integer,
  account_id integer,
  platform text not null default '',
  channel text not null default '',
  ok integer not null default 0,
  platform_post_id text not null default '',
  url text not null default '',
  error_class text not null default '',
  detail text not null default '',
  at text not null default (datetime('now'))
);

create table if not exists metric (
  id integer primary key autoincrement,
  content_id integer references content(id) on delete cascade,
  platform text not null default '',
  day text not null,
  impressions integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  clicks integer not null default 0,
  sessions integer not null default 0,
  orders_amount real not null default 0,
  inquiries integer not null default 0,
  unique (content_id, day)
);

create table if not exists lead (
  id integer primary key autoincrement,
  source text not null default '',
  platform text not null default '',
  profile_url text not null default '',
  name text not null default '',
  company text not null default '',
  title text not null default '',
  region text not null default '',
  email text not null default '',
  email_status text not null default '',
  whatsapp text not null default '',
  score integer not null default 0,
  stage text not null default 'new',
  note text not null default '',
  created_at text not null default (datetime('now')),
  unique (platform, profile_url)
);

create table if not exists job (
  id integer primary key autoincrement,
  kind text not null,
  payload text not null default '{}',
  state text not null default 'queued',
  run_at text not null default (datetime('now')),
  attempts integer not null default 0,
  last_error text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists audit_log (
  id integer primary key autoincrement,
  at text not null default (datetime('now')),
  actor text not null default 'local',
  action text not null,
  target text not null default '',
  detail text not null default '{}'
);

create table if not exists platform_limit (
  platform text primary key,
  min_interval_sec integer not null default 30,
  daily_cap integer not null default 20,
  cooldown_after_fail integer not null default 300,
  note text not null default ''
);

create table if not exists rate_state (
  platform text primary key,
  day text not null default '',
  count integer not null default 0,
  last_at text not null default '',
  cooldown_until text not null default ''
);

create table if not exists ai_analysis (
  id integer primary key autoincrement,
  target_kind text not null,
  target_id integer not null,
  mode text not null,
  payload text not null,
  model text not null default '',
  created_at text not null default (datetime('now'))
);

create table if not exists kb_item (
  id integer primary key autoincrement,
  kind text not null default 'brand',
  title text not null,
  content text not null,
  tags text not null default '',
  weight integer not null default 50,
  enabled integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);
create table if not exists radar_seen (
  url text primary key,
  seen_at text not null default (datetime('now'))
);

create table if not exists radar_snapshot (
  id integer primary key check (id = 1),
  payload text not null,
  fetched_at text not null default (datetime('now'))
);

create table if not exists platform_catalog (
  code text primary key,
  label text not null,
  kind text not null default 'social',
  channel_state text not null default 'pending_api',
  channel_note text not null default '',
  sort integer not null default 100
);
`);

/* 平台标签策略（ARTEX 任务 #10 交付） */
db.exec(`create table if not exists platform_tag_policy (
  platform text primary key,
  min_tags integer not null default 2,
  max_tags integer not null default 5,
  layer_quota text not null default '{"broad":1,"niche":2,"audience":1}',
  tag_style text not null default 'hashtag',
  link_mode text not null default 'text',
  text_limit integer not null default 600,
  note text default ''
)`);
{
  const seed = [
    ['bluesky', 2, 3, '{"broad":1,"niche":2,"audience":1}', 'hashtag', 'embed', 300, '链接走 link card，不占正文'],
    ['instagram', 6, 12, '{"broad":2,"niche":4,"audience":3}', 'hashtag', 'profile', 2200, '链接放 bio，正文不堆链接'],
    ['pinterest', 5, 8, '{"broad":2,"niche":3,"audience":2}', 'keyword', 'text', 500, '关键词式，不用 #'],
    ['tiktok', 2, 4, '{"broad":1,"niche":2,"audience":1}', 'hashtag', 'profile', 2200, ''],
    ['facebook_page', 2, 3, '{"broad":1,"niche":1,"audience":1}', 'hashtag', 'text', 600, ''],
  ];
  const ins = db.prepare('insert or ignore into platform_tag_policy(platform,min_tags,max_tags,layer_quota,tag_style,link_mode,text_limit,note) values (?,?,?,?,?,?,?,?)');
  for (const r of seed) ins.run(...r);
}

/* 老库补列：content.image_path / image_alt */
{
  const cols = db.prepare('PRAGMA table_info(content)').all().map((c) => c.name);
  if (!cols.includes('image_path')) db.exec('alter table content add column image_path text');
  if (!cols.includes('image_alt')) db.exec('alter table content add column image_alt text');
}

/* 老库补列：content.image_prompt */
{
  const cols = db.prepare('PRAGMA table_info(content)').all().map((c) => c.name);
  if (!cols.includes('image_prompt')) db.exec('alter table content add column image_prompt text');
}

/* 老库补列：metric.inquiries */
{
  const cols = db.prepare('PRAGMA table_info(metric)').all().map((c) => c.name);
  if (!cols.includes('inquiries')) db.exec('alter table metric add column inquiries integer not null default 0');
}

/* 老库补列：metric.source / hotspot 的发现字段 */
{
  const cols = db.prepare('PRAGMA table_info(metric)').all().map((c) => c.name);
  if (!cols.includes('source')) db.exec("alter table metric add column source text not null default 'manual'");
}
{
  const cols = db.prepare('PRAGMA table_info(hotspot)').all().map((c) => c.name);
  const add = [
    ['kind', "text not null default 'post'"],
    ['published', "text not null default ''"],
    ['snippet', "text not null default ''"],
    ['score_type', "text not null default 'manual'"],
  ];
  for (const [name, ddl] of add) {
    if (!cols.includes(name)) db.exec(`alter table hotspot add column ${name} ${ddl}`);
  }
}


const DEFAULTS = [
  ['site_name', 'Packrivo 外贸社媒工作台'],
  ['brand_tone', '专业'],
  ['primary_lang', 'en'],
  ['market', '欧美'],
  ['public_base_url', 'https://social.packrivo.com'],
  ['review_sensitive_enabled', '1'],
  ['review_sensitive_extra', ''],   // 额外敏感词，逗号分隔
  ['video_provider_note', ''],      // 视频接口备注，填了之后 /api/video/generate 才会调用
  ['video_api_path', '/videos/generations'],
  ['apify_token', ''],
  ['apify_actor', ''],
  ['seed_keywords', JSON.stringify([
    'custom mailer box', 'kraft mailer box', 'custom packaging boxes', 'eco friendly packaging',
    'corrugated shipping box', 'printed shipping boxes', 'subscription box packaging',
    'rigid gift box', 'folding carton packaging', 'sustainable packaging supplier',
    'custom tissue paper', 'branded packaging tape', 'poly mailer custom print',
    'cosmetic packaging box', 'apparel packaging bag', 'food grade packaging box',
    'magnetic closure box', 'packaging insert custom', 'low moq custom packaging',
    'packaging supplier for small business'
  ])],
  ['publish_mode', 'semi'],           // auto | semi | manual
  ['publish_channel_default', 'mock'],// mock | postiz | webhook
  ['postiz_base', ''],
  ['utm_source_map', '{"facebook_page":"facebook","instagram":"instagram","tiktok":"tiktok","pinterest":"pinterest"}'],
  ['weekly_quota', '5'],
  ['llm_task_models', '{"deconstruct":"deepseek-v4.1-flash","rewrite":"deepseek-v4.1-flash","review":"step-5-preview","report":"space-bunny"}'],
  ['profile_ready', '0'],
  ['category', ''],
  ['sub_niches', ''],
  ['markets', '欧美'],
  ['brand_name', 'Packrivo'],
  ['brand_site', 'https://packrivo.com'],
  ['competitors', '[]'],
  ['worker_enabled', '1'],
];
const insSetting = db.prepare('insert or ignore into setting(k, v) values (?, ?)');
for (const [k, v] of DEFAULTS) insSetting.run(k, v);

const LIMITS = [
  ['facebook_page', 60, 25, 600, '官方 API，需 Meta 审核'],
  ['instagram', 90, 20, 900, '需专业号 + Meta 审核'],
  ['tiktok', 120, 10, 1800, '内容发布接口需审核'],
  ['pinterest', 90, 20, 900, ''],
  ['linkedin', 90, 15, 900, '官方 API 门槛高'],
  ['x', 60, 20, 600, ''],
  ['youtube', 120, 10, 1800, '配额制'],
  ['mock', 1, 100000, 10, '本地通道'],
  ['webhook', 1, 100000, 10, '本地通道'],
  ['postiz', 5, 10000, 60, '交给 Postiz 队列'],
];
const insLimit = db.prepare('insert or ignore into platform_limit(platform, min_interval_sec, daily_cap, cooldown_after_fail, note) values (?, ?, ?, ?, ?)');
for (const row of LIMITS) insLimit.run(...row);

/* 平台能力目录：社媒 / 论坛 / B2B / 私信 / 本地。
   channel_state: ready=本地已通 · pending_config=填配置即通 · pending_postiz=交给 Postiz · pending_api=需平台资质 · pending_session=只能浏览器会话 · manual_only=只能人工 */
const PLATFORMS = [
  ['facebook_page', 'Facebook 主页', 'social', 'pending_postiz', 'Meta 应用审核 + 主页授权，走 Postiz 或 Graph API', 10],
  ['facebook_group', 'Facebook 群组', 'forum', 'pending_session', '无发布 API，需浏览器会话，风险中', 20],
  ['instagram', 'Instagram', 'social', 'pending_postiz', '专业号 + Meta 审核', 30],
  ['threads', 'Threads', 'social', 'pending_api', 'Threads API 需应用审核', 40],
  ['tiktok', 'TikTok', 'social', 'pending_postiz', '内容发布 API 需审核', 50],
  ['youtube', 'YouTube', 'social', 'pending_api', 'Data API 配额制，上传需 OAuth', 60],
  ['linkedin', 'LinkedIn', 'social', 'pending_api', '营销 API 需企业资质，个人号靠会话', 70],
  ['pinterest', 'Pinterest', 'social', 'pending_postiz', '需 App 审核', 80],
  ['x', 'X (Twitter)', 'social', 'pending_api', '付费档才有发帖额度', 90],
  ['reddit', 'Reddit', 'forum', 'pending_session', 'API 可发帖但要注册应用与配额，版规严', 100],
  ['quora', 'Quora', 'forum', 'manual_only', '无公开发布 API，人工或会话', 110],
  ['warrior_forum', 'Warrior Forum', 'forum', 'pending_session', '外贸/营销垂直论坛，会话发帖', 120],
  ['alibaba', 'Alibaba 国际站', 'b2b', 'pending_api', '需店铺 + 开放平台权限', 130],
  ['made_in_china', '中国制造网', 'b2b', 'pending_api', '需会员与开放接口权限', 140],
  ['globalsources', '环球资源', 'b2b', 'pending_api', '需账号与接口权限', 150],
  ['whatsapp', 'WhatsApp Business', 'im', 'pending_api', 'Cloud API 模板消息，需 Meta 商业验证', 160],
  ['telegram', 'Telegram 频道', 'im', 'pending_config', 'Bot Token 填了即可发频道消息', 170],
  ['email', '邮件 EDM', 'im', 'pending_config', 'SMTP 配置后可用', 180],
  ['mock', '本地模拟通道', 'local', 'ready', '发布链路自测用，不接触真实平台', 900],
  ['webhook', '自定义 Webhook', 'local', 'ready', 'POST 到你自己的接收端', 910],
];
const insPlat = db.prepare('insert or ignore into platform_catalog(code, label, kind, channel_state, channel_note, sort) values (?, ?, ?, ?, ?, ?)');
for (const row of PLATFORMS) insPlat.run(...row);

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

/* 密钥类设置项：落库前 'enc:' + AES-256-GCM 密文，读的时候透明解密。
   这样 setting 表、/api/settings 响应、审计日志里都不会再出现明文密钥。 */
export function setting(k) {
  const r = get('select v from setting where k = ?', k);
  if (!r) return null;
  const v = r.v;
  if (v && v.startsWith('enc:')) {
    try { return decrypt(v.slice(4)); } catch { return ''; }
  }
  return v;
}

export function setSetting(k, v) {
  const key = String(k);
  const raw = v === null || v === undefined ? '' : String(v);
  const stored = SECRET_KEYS.has(key) && raw ? 'enc:' + encrypt(raw) : raw;
  return run('insert into setting(k, v) values (?, ?) on conflict(k) do update set v = excluded.v', key, stored);
}

export const audit = (action, target = '', detail = {}) =>
  run('insert into audit_log(action, target, detail) values (?, ?, ?)', action, target, JSON.stringify(detail));
export const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const today = () => new Date().toISOString().slice(0, 10);

/* 一次性迁移：历史明文密钥 → 密文；顺带把审计日志里的明文密钥洗成 ****后4位。
   幂等：已加密的跳过；洗过的行不再匹配。 */
export function migratePlaintextSecrets() {
  const out = { encrypted: [], scrubbed_rows: 0 };
  const plaintext = [];
  for (const row of all('select k, v from setting order by k')) {
    if (!SECRET_KEYS.has(row.k)) continue;
    const v = row.v || '';
    if (!v || v.startsWith('enc:')) continue;
    plaintext.push(v);
    setSetting(row.k, v);
    out.encrypted.push(row.k);
  }
  // 已知密钥值之外，兜住 sk- 开头的 api key 形态
  const genericRe = /sk-[A-Za-z0-9_-]{8,}/g;
  for (const r of all("select id, detail from audit_log where detail <> '' and detail is not null")) {
    let d = r.detail;
    let hit = false;
    for (const s of plaintext) {
      if (s && s.length >= 8 && d.includes(s)) {
        d = d.split(s).join(maskSecret(s));
        hit = true;
      }
    }
    const masked = d.replace(genericRe, (m) => maskSecret(m));
    if (masked !== d) hit = true;
    if (!hit) continue;
    run('update audit_log set detail = ? where id = ?', masked, r.id);
    out.scrubbed_rows += 1;
  }
  if (out.encrypted.length || out.scrubbed_rows) {
    console.log(`[db] 密钥迁移：加密 ${out.encrypted.length} 项（${out.encrypted.join(', ') || '-'}），清洗审计日志 ${out.scrubbed_rows} 行`);
  }
  return out;
}

migratePlaintextSecrets();
