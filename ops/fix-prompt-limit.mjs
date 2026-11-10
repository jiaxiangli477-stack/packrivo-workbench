import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let s = readFileSync(p, 'utf8');

const old = "  const prompt = `你是外贸包装行业的社媒文案。按下面的产品资料与参考结构写一条${platform}帖子，语言=${lang}，语气=${tone}。";
const neu = `  const LIMIT = platform === 'bluesky' ? '正文≤250 字符；加上链接和标签后必须 ≤300 字符（Bluesky 硬限制）'
    : platform === 'x' ? '正文≤240 字符'
    : platform === 'instagram' ? '正文≤1800 字符，前 125 字符要能独立成句'
    : platform === 'pinterest' ? '正文≤500 字符，用关键词句而不是长文'
    : '正文≤600 字符';
  const prompt = \`你是外贸包装行业的社媒文案。按下面的产品资料与参考结构写一条\${platform}帖子，语言=\${lang}，语气=\${tone}。
   字数要求：\${LIMIT}\`;`;

if (!s.includes(old)) { console.log('anchor missing'); process.exit(1); }
s = s.replace(old, () => neu);

/* 原 prompt 后续字符串现在是模板字面量的一部分，需要把原来的反引号结尾保留：
   我们只替换了开头，原文本以 ` 结尾，语法仍然成立 */
writeFileSync(p, s, 'utf8');
console.log('platform char limit added');
