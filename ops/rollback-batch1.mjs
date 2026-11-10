/* 批次一回滚 / 降级（配合 ops/migrate-batch1.mjs）
 *
 * 回滚分两档，默认只做第一档：
 *  1) 软回滚（默认）：备份 + 删掉 schema_migration 里的批次一 marker。
 *     批次一全部是「新增列 + 新增列默认值」，旧代码从不读这些列，所以删 marker 就能让新代码
 *     以为迁移没跑过，而库本身对旧代码完全兼容。数据与列都留着，随时能再迁。
 *  2) 硬回滚（--drop-columns）：备份后再把这些新列从表上摘掉。
 *     SQLite 的 drop column 在旧版本 / 有索引或触发器引用时会失败，所以逐列 try，
 *     失败原样报出来不中断；要「彻底干净的降级」优先用 VACUUM INTO 导出一份旧结构库，
 *     而不是在生产库上硬摘列。
 *
 *   node ops/rollback-batch1.mjs --data <dir> --yes
 *   node ops/rollback-batch1.mjs --data <dir> --yes --drop-columns
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
const dropColumns = args.includes('--drop-columns');
const allowForeign = args.includes('--allow-foreign-data');

if (!args.includes('--yes')) {
  console.error('回滚会写库。确认后加 --yes 再跑。');
  console.error(`目标：${dbPath}`);
  process.exit(2);
}
if (!fs.existsSync(dbPath)) {
  console.error(`库不存在：${dbPath}`);
  process.exit(2);
}
if (!allowForeign && /[\\/]social-workbench[\\/]data[\\/]?$/.test(dataDir)) {
  console.error(`拒绝执行：${dataDir} 看起来是原仓库的生产数据目录。`);
  process.exit(2);
}

const MIGRATION_ID = '2026-11-batch1';
const BATCH1_COLUMNS = {
  content: ['content_version', 'approved_version'],
  review: ['content_version'],
  account: ['integration_id', 'integration_identifier'],
  schedule: ['content_version', 'delivery_state', 'attempt', 'next_attempt_at', 'postiz_post_id',
    'platform_post_id', 'public_url', 'remote_state', 'intent_id', 'claimed_at', 'sending_at', 'publish_mode'],
  job: ['intent_id', 'lease_until'],
  publish_result: ['postiz_post_id', 'platform_post_id', 'delivery_state'],
};

const raw = new DatabaseSync(dbPath);
const out = { dbPath, mode: dropColumns ? 'hard(drop-columns)' : 'soft(marker-only)', backup: '', dropped: [], kept: [], errors: [] };
try {
  raw.exec('pragma busy_timeout = 5000');

  // 1. 备份：批次一碰过的表整表导出成 JSON，回滚失败或误删时有据可查。
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dataDir, `rollback-batch1-${stamp}.json`);
  const tables = { setting: ["select * from setting where k in ('batch1_legacy_approval','postiz_base','postiz_type','postiz_key')"] };
  for (const t of Object.keys(BATCH1_COLUMNS)) tables[t] = [`select * from ${t}`];
  tables.schema_migration = ['select * from schema_migration'];
  const backup = { at: new Date().toISOString(), dbPath, tables: {} };
  for (const [t, [sql]] of Object.entries(tables)) {
    try { backup.tables[t] = raw.prepare(sql).all(); } catch (e) { backup.tables[t] = { error: e.message }; }
  }
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  out.backup = backupPath;

  // 2. 软回滚：删 marker。旧代码只认自己的迁移标记，不认批次一。
  const del = raw.prepare('delete from schema_migration where id = ?').run(MIGRATION_ID);
  out.marker_deleted = del.changes;

  // 3. 硬回滚（可选）：逐列摘，失败逐条记录。
  if (dropColumns) {
    for (const [t, cols] of Object.entries(BATCH1_COLUMNS)) {
      const have = new Set(raw.prepare(`select name from pragma_table_info('${t}')`).all().map((c) => c.name));
      for (const c of cols) {
        if (!have.has(c)) { out.kept.push(`${t}.${c}(本就不存在)`); continue; }
        try {
          raw.exec(`alter table ${t} drop column ${c}`);
          out.dropped.push(`${t}.${c}`);
        } catch (e) {
          out.errors.push(`${t}.${c}: ${e.message}`);
          out.kept.push(`${t}.${c}`);
        }
      }
    }
  } else {
    for (const [t, cols] of Object.entries(BATCH1_COLUMNS)) out.kept.push(...cols.map((c) => `${t}.${c}`));
  }

  out.remaining_columns = {};
  for (const [t, cols] of Object.entries(BATCH1_COLUMNS)) {
    const have = new Set(raw.prepare(`select name from pragma_table_info('${t}')`).all().map((c) => c.name));
    out.remaining_columns[t] = cols.filter((c) => have.has(c));
  }
  out.schema_migration_rows = raw.prepare('select id, at from schema_migration order by id').all();
  out.sqlite_version = raw.prepare('select sqlite_version() as v').get().v;
} finally {
  raw.close();
}

console.log('[rollback-batch1] 结果：');
console.log(JSON.stringify(out, null, 2));
if (out.errors.length) {
  console.error('[rollback-batch1] 有列没摘掉（库结构已部分降级，仍向下兼容），逐条见 errors');
  process.exit(1);
}
console.log(dropColumns
  ? '[rollback-batch1] 硬回滚完成：新列已摘除'
  : '[rollback-batch1] 软回滚完成：marker 已删，列保留（旧代码不读新列，可直接跑旧版本）');
