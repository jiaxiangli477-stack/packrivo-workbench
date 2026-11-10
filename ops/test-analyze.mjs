import { chat } from '../app/llm.mjs';
const prompt = `你是外贸独立站的 SEO 与 GEO 优化师。分析下面这条 instagram 帖子，只输出 JSON：
{"seo":{"score":0-100,"issues":["..."],"fixes":["..."]},"geo":{"score":0-100,"issues":["..."],"fixes":["..."]},"keywords":["3-5 个建议主打的英文关键词"],"optimized_title":"改好的标题","optimized_points":["3-5 条可直接照改的点"]}

标题：POV: you're taping another mailer shut again.
正文：Extra steps slow fulfillment—and the unboxing feels less premium than your brand. PK-MAILER-01 is a one-sheet kraft mailer box: no tape, clean assembly. 25x20x8cm, 300g kraft, recyclable, with CMYK custom printing. MOQ 500. 7-day sample turnaround.
标签：#custommailerbox #kraftpackaging
落地页：https://packrivo.com/mailer-box?utm_source=instagram

只输出一个 JSON 对象：第一个字符是 {，最后一个字符是 }。不要解释、不要 Markdown 代码块、不要在 JSON 前后写任何文字。`;
const r = await chat({ task: 'review', messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 2400 });
console.log('via', r.via, 'len', r.content.length);
console.log('RAW>>>');
console.log(r.content.slice(0, 1200));