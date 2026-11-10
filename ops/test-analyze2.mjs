import { chat } from '../app/llm.mjs';
const prompt = `只输出 JSON：{"seo":{"score":0-100,"issues":["..."],"fixes":["..."]},"geo":{"score":0-100,"issues":["..."],"fixes":["..."]},"keywords":["..."],"optimized_title":"...","optimized_points":["..."]}
分析这条 Instagram 帖子：标题 POV: you're taping another mailer shut again. 正文：one-sheet kraft mailer box, no tape, 25x20x8cm, 300g, MOQ 500, 7-day sample, CMYK print. 标签 #custommailerbox #kraftpackaging。落地页 https://packrivo.com/mailer-box`;
for (const m of ['space-bunny','glm-5.3-flash','deepseek-v4.1-flash']) {
  const t0=Date.now();
  try {
    const r = await chat({ task: 'review', model: m, messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 2600 });
    const ok = /\{"seo"|"seo"\s*:/.test(r.content);
    console.log('===', m, 'via', r.via, 'len', r.content.length, 'hasJson', ok, ((Date.now()-t0)/1000).toFixed(1)+'s');
    console.log(r.content.slice(0, 260).replace(/\s+/g,' '));
  } catch(e){ console.log('===', m, 'ERR', e.message.slice(0,120)); }
}