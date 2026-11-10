import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
db.prepare("update account set handle='@packrivo.bsky.social', profile_url='https://bsky.app/profile/packrivo.bsky.social' where platform='bluesky'").run();
console.log('bluesky handle set:', JSON.stringify(db.prepare("select id,platform,handle from account").all()));