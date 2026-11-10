/* 批次一增量迁移 / 迁移自查（单独跑，不依赖服务起着）
 *
 * 设计取舍：这里不复制 db.mjs 里的 DDL，而是先定好数据目录，再 import ../app/db.mjs，
 * 让「真实的那份迁移代码」自己跑一遍。复制 DDL 的脚本迟早和服务代码漂移，
 * 而审计报告要的是「这份代码在真实库上的实际行为」，不是脚本自己的行为。
 *
 *   node ops/migrate-batch1.mjs                       # 按 $SWB_DATA 或 ../data 迁移
 *   node ops/migrate-batch1.mjs --data E:\tmp\swbdata # 指定数据目录
 *   node ops/migrate-batch1.mjs --grandfather-legacy  # 把历史上已批准的内容按 grandfather 保留批准
 *
 * 默认策略 conservative：历史 approved/scheduled/published 内容的 approved_version 保持 0，
 * 也就是「老数据想发就必须重新点一次通过」。这是审计要求的口径 —— 旧审核记录没有版本绑定，
 * 不能凭 status='approved' 就当成有效批准。
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
}

const ROOT = path.resolve(import.meta.dirname, '..');
const dataDir = path.resolve(argVal('--data') || process.env.SWB_DATA || path.join(ROOT, 'data'));
const dbPath = path.join(dataDir, 'workbench.db');
const grandfather = args.includes('--grandfather-legacy');
const allowForeign = args.includes('--allow-foreign-data');

// 防手滑：原仓库 social-workbench\data 里是 8795 生产实例的数据，迁移只该发生在新副本上。
if (!allowForeign && /[\\/]social-workbench[\\/]data[\\/]?$/.test(dataDir)) {
  console.error(`拒绝执行：${dataDir} 看起来是原仓库的生产数据目录。`);
  console.error('换 --data 指到副本目录，或明确加 --allow-foreign-data。');
  process.exit(2);
}

console.log(`[migrate-batch1] data   = ${dataDir}`);
console.log(`[migrate-batch1] db     = ${dbPath}`);
console.log(`[migrate-batch1] policy = ${grandfather ? 'grandfather（沿用历史批准）' : 'conservative（历史批准需重新审核）'}`);

// db.mjs 在 import 时读 process.env.SWB_DATA 定 DATA_DIR，所以必须先设好再 import。
process.env.SWB_DATA = dataDir;
fs.mkdirSync(dataDir, { recursive: true });

// grandfather 策略要在 db.mjs 跑迁移前落进 setting，否则迁移块读不到它。
if (grandfather) {
  const raw = new DatabaseSync(dbPath);
  try {
    raw.exec('create table if not exists setting (k text primary key, v text)');
    raw.prepare('insert into setting(k, v) values (?, ?) on conflict(k) do update set v = excluded.v')
      .run('batch1_legacy_approval', 'grandfather');
  } finally {
    raw.close();
  }
}

const existedBefore = fs.existsSync(dbPath);
const db = await import('../app/db.mjs');
const { all, get, setting } = db;

const columnsOf = (table) => all(`select name, type, dflt_value from pragma_table_info('${table}')`);

const BATCH1_COLUMNS = {
  content: ['content_version', 'approved_version'],
  review: ['content_version'],
  account: ['integration_id', 'integration_identifier'],
  schedule: ['content_version', 'delivery_state', 'attempt', 'next_attempt_at', 'postiz_post_id',
    'platform_post_id', 'public_url', 'remote_state', 'intent_id', 'claimed_at', 'sending_at', 'publish_mode'],
  job: ['intent_id', 'lease_until'],
  publish_result: ['postiz_post_id', 'platform_post_id', 'delivery_state'],
};

const columnReport = {};
let missing = 0;
let present = 0;
for (const [table, cols] of Object.entries(BATCH1_COLUMNS)) {
  const have = new Set(columnsOf(table).map((c) => c.name));
  columnReport[table] = {
    present: cols.filter((c) => have.has(c)),
    missing: cols.filter((c) => !have.has(c)),
  };
  present += columnReport[table].present.length;
  missing += columnReport[table].missing.length;
}

const markers = all('select id, at from schema_migration order by id');
const contentByStatus = all("select status, count(*) as n, sum(case when approved_version = content_version and approved_version > 0 then 1 else 0 end) as approved_bound from content group by status");
const scheduleByState = all("select state, delivery_state, count(*) as n from schedule group by state, delivery_state");
const pubResultStats = get(`select
    sum(case when postiz_post_id <> '' then 1 else 0 end) as with_postiz_id,
    sum(case when platform_post_id <> '' then 1 else 0 end) as with_platform_id,
    sum(case when delivery_state = 'unknown' then 1 else 0 end) as unknown_state,
    count(*) as total
  from publish_result`) || {};

const report = {
  ok: missing === 0,
  dataDir,
  dbPath,
  dbExistedBefore: existedBefore,
  policy: grandfather ? 'grandfather' : 'conservative',
  setting_batch1_legacy_approval: setting('batch1_legacy_approval') || '',
  schema_migration: markers,
  batch1_migration_id: db.BATCH1_MIGRATION,
  columns: columnReport,
  columns_present: present,
  columns_missing: missing,
  content_by_status: contentByStatus,
  schedule_by_state: scheduleByState,
  publish_result: pubResultStats,
};

console.log('[migrate-batch1] 报告：');
console.log(JSON.stringify(report, null, 2));

if (missing !== 0) {
  console.error('[migrate-batch1] 有列没加上，迁移不完整');
  process.exit(1);
}
console.log(`[migrate-batch1] 完成：${present} 个批次一列在位，marker = ${markers.map((m) => m.id).join(',') || '(空)'}`);
