import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const before = db.prepare("select id, owner_id, field from credential where owner_kind='account'").all();
console.log('creds before:', JSON.stringify(before));
const del = db.prepare("delete from credential where owner_kind='account' and owner_id=3 and field in ('instance','access_token')").run();
console.log('deleted fake rows:', del.changes);
db.prepare("update account set session_state='unknown' where id=3").run();
console.log('creds after:', JSON.stringify(db.prepare("select id, owner_id, field from credential where owner_kind='account'").all()));
