import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/ops/test-race2.mjs';
let c = readFileSync(p, 'utf8');
c = c.replace("console.log('worker_enabled =', JSON.stringify(db.prepare(\"select value from setting where key='worker_enabled'\").get()));",
  "console.log('setting cols:', db.prepare('PRAGMA table_info(setting)').all().map(x=>x.name).join(','));");
writeFileSync(p, c, 'utf8');