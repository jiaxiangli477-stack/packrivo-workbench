import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/channels.mjs';
let c = readFileSync(p, 'utf8');
const old = `function postText(content) {
  return [content.title, content.body, content.hashtags].filter(Boolean).join('\\n\\n').trim();
}`;
const neu = `function postText(content) {
  const parts = [content.title, content.body].filter(Boolean);
  let text = parts.join('\\n\\n').trim();
  const link = String(content.utm_url || '').trim();
  if (link && !text.includes(link)) text += '\\n\\n' + link;
  if (content.hashtags) text += '\\n\\n' + content.hashtags;
  return text.trim();
}`;
if (!c.includes(old)) { console.log('MISS postText'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('postText now appends utm_url');