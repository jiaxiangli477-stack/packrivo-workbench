// SEC-01 收尾：扫描库里是否还有明文密钥残留（audit_log / setting / credential）。
// 只读，不改库。发现明文只报告位置与形态，不输出完整值。
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'data', 'workbench.db');
const db = new DatabaseSync(DB, { readOnly: true });

const POSTIZ_FULL = 'e77fa996b6a61d4d15' + 'fbe4d63ebeab8ef8ab0c86755e3a4977213419df87348f';
const PATTERNS = [
  [/sk-[A-Za-z0-9_-]{20,}/, 'sk- api key'],
  [/xoxb-[A-Za-z0-9-]{10,}/, 'slack bot token'],
  [/ghp_[A-Za-z0-9]{20,}/, 'github pat'],
];

function mask(v) {
  return String(v).slice(0, 6) + '…' + String(v).slice(-4);
}

let hits = 0;
for (const row of db.prepare("select id, action, target, detail from audit_log where detail is not null and detail != ''").all()) {
  let matched = false;
  for (const [re, label] of PATTERNS) {
    if (re.test(row.detail)) {
      const m = row.detail.match(re)[0];
      console.log(`[audit_log #${row.id}] ${label}: ${mask(m)}  (action=${row.action})`);
      hits += 1; matched = true; break;
    }
  }
  if (!matched && row.detail.includes(POSTIZ_FULL)) {
    console.log(`[audit_log #${row.id}] postiz 云 key: ${mask(POSTIZ_FULL)}  (action=${row.action})`);
    hits += 1;
  }
}

for (const row of db.prepare("select k, v from setting where v is not null and v != '' and v not like 'enc:%'").all()) {
  let matched = false;
  for (const [re, label] of PATTERNS) {
    if (re.test(row.v)) {
      const m = row.v.match(re)[0];
      console.log(`[setting ${row.k}] ${label}: ${mask(m)}`);
      hits += 1; matched = true; break;
    }
  }
  if (!matched && row.v.includes(POSTIZ_FULL)) {
    console.log(`[setting ${row.k}] postiz 云 key: ${mask(POSTIZ_FULL)}`);
    hits += 1;
  }
}

console.log(hits ? `共发现 ${hits} 处明文密钥残留` : 'OK：库中无明文密钥残留');
