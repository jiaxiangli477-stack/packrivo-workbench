import { chat } from '../app/llm.mjs';
import { extractJson } from '../app/json.mjs';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');
const c = db.prepare('select * from content where id = 17').get();
const row = db.prepare("select payload from ai_analysis where target_kind='content' and target_id=17 order by id desc limit 1").get();
const a = JSON.parse(row.payload);
const issues = [...(a.seo?.issues || []), ...(a.geo?.issues || [])].slice(0, 4);

const prompt = `重写这条 ${c.platform} 帖子，修掉下面问题，保留原有事实，不新增价格/交期/认证。
原文：
${String(c.body).slice(0, 700)}

问题：
${issues.map((x, i) => (i + 1) + '. ' + String(x).slice(0, 120)).join('\n')}

正文 ≤200 字符，标题一句钩子，正文不放链接。
只输出 JSON：{"title":"...","body":"...","hashtags":"..."}`;

const r = await chat({ task: 'rewrite', messages: [{ role: 'user', content: prompt }], temperature: 0.7, maxTokens: 2000 });
console.log('via:', r.via, 'len:', String(r.content).length);
console.log('--- raw ---');
console.log(String(r.content).slice(0, 800));
console.log('--- extract ---');
console.log(JSON.stringify(extractJson(r.content, ['body'])));
