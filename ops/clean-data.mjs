import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');

/* 1) 删掉 #11（AI 思考草稿） */
const c11 = db.prepare('select id,title,substr(body,1,80) as head from content where id = 11').get();
if (c11) {
  db.prepare('delete from content where id = ?').run(11);
  console.log('deleted content #11:', c11.head.replace(/\s+/g, ' ').slice(0, 60));
}

/* 2) 清掉测试指标 */
const rows = db.prepare('select id, content_id, day, impressions, inquiries from metric').all();
for (const r of rows) {
  db.prepare('delete from metric where id = ?').run(r.id);
  console.log('deleted metric #' + r.id, 'content', r.content_id, 'imp', r.impressions, 'inq', r.inquiries);
}

/* 3) 修 #12 的 UTM（amp 混进 slug） */
const c12 = db.prepare('select id, utm_url from content where id = 12').get();
if (c12) {
  const fixed = String(c12.utm_url).replace(/-amp-/g, '-and-').replace(/-+/g, '-');
  db.prepare('update content set utm_url = ? where id = ?').run(fixed, 12);
  console.log('fixed utm #12 ->', fixed);
}

/* 4) 全库扫一遍思考泄漏样本（除刚删的） */
const LEAK = [/we need (answer|output|craft|respond)/i, /i need (to )?(respond|answer|craft)/i, /只输出\s*JSON/i, /^\s*```/];
const all = db.prepare('select id, title, body from content').all();
for (const c of all) {
  if (LEAK.some((re) => re.test(c.body))) {
    db.prepare("update content set status = 'rejected' where id = ?").run(c.id);
    console.log('rejected leaking content #' + c.id);
  }
}
console.log('remaining contents:', db.prepare('select count(*) c from content').get().c);
console.log('remaining metrics:', db.prepare('select count(*) c from metric').get().c);
