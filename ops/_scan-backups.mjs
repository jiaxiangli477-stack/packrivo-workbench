import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const dbs = [
  '../.tmp/audit/workbench.db',
  '../.tmp/audit/snap/workbench.db',
  '../.tmp/audit/sim/data/workbench.db',
  '../.tmp/audit/sim4/data/workbench.db',
  '../.tmp/audit/sim5/data/workbench.db',
  '../.tmp/audit/data2/workbench.db',
  '../.tmp/audit/data3/workbench.db',
  '../.tmp/audit/data4/workbench.db',
  '../.tmp/audit/e2e-cloud/data/workbench.db',
];

for (const p of dbs) {
  const full = join(process.cwd(), p);
  if (!existsSync(full)) { console.log('SKIP', p, '(missing)'); continue; }
  try {
    const db = new DatabaseSync(full, { readOnly: true });
    const s = db.prepare("select v from setting where k='postiz_api_key'").get();
    const c = db.prepare("select hint, cipher from credential where owner_kind='channel' and owner_id=0 and field='postiz_key' order by id desc limit 1").get();
    const b = db.prepare("select k, v from setting where k='postiz_base' or k='postiz_base_url'").all();
    const audit = db.prepare("select id, detail from audit_log where detail like '%postiz_api_key%' order by id").all();
    console.log('===', p);
    console.log('  setting.postiz_api_key =', s ? s.v.slice(0, 90) : '(none)');
    console.log('  credential =', c ? JSON.stringify({ hint: c.hint, clen: (c.cipher || '').length }) : '(none)');
    console.log('  base =', JSON.stringify(b.map(x => x.v)));
    for (const a of audit) {
      const m = a.detail.match(/"postiz_api_key":"([^"]*)"/);
      console.log('  audit id=' + a.id, m ? ('key=' + m[1].slice(0, 70)) : '(detail has postiz_api_key but no quoted value)');
    }
    db.close();
  } catch (e) { console.log('===', p, 'ERR', e.message); }
}
