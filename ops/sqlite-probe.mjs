import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:');
db.exec('create table t(id integer primary key, v text)');
db.prepare('insert into t(v) values (?)').run('ok');
console.log('node:sqlite OK ->', JSON.stringify(db.prepare('select * from t').all()));