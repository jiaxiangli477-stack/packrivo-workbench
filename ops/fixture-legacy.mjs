/* 一次性夹具：造一个「批次一之前」的库，用来验证 grandfather 回填路径。
   1) 先按当前代码迁一遍（拿到所有列）
   2) 插 3 条历史内容：approved / published / pending_review，approved_version 全为 0
   3) 再跑 ops/rollback-batch1.mjs --drop-columns --yes（把列摘掉 = 回到批次一之前）
   4) 然后 ops/migrate-batch1.mjs --grandfather-legacy 应打印「按 grandfather 保留历史批准 2 条」
*/
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = process.argv[2];
if (!dir) { console.error('用法: node ops/fixture-legacy.mjs <dataDir>'); process.exit(2); }
process.env.SWB_DATA = path.resolve(dir);
const db = await import('../app/db.mjs');
const { run, all } = db;

const mk = (status, title) => run(
  "insert into content(platform, lang, title, body, status, content_version, approved_version) values (?,?,?,?,?,1,0)",
  'linkedin', 'en', title, 'fixture body ' + title, status
);
mk('approved', 'legacy-approved');
mk('published', 'legacy-published');
mk('pending_review', 'legacy-pending');
console.log('[fixture] content 写入完成');
console.log(JSON.stringify(all('select id, status, content_version, approved_version from content order by id'), null, 2));
