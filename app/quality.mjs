/* 内容质检：用 kimi 审一遍雷达抓到的条目与关键词，给出分数与判定 */
import { chat } from './llm.mjs';

function extractJson(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const cands = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { cands.push(JSON.parse(s.slice(i, j + 1))); } catch {}
          i = j;
          break;
        }
      }
    }
  }
  return cands.length ? cands[cands.length - 1] : null;
}

const JSON_RULE = '\n只输出一个 JSON 对象，第一个字符是 {，最后一个字符是 }，不要解释、不要代码块。';

export async function auditContent({ category, videos = [], posts = [], articles = [] }) {
  const items = [
    ...videos.map((x, i) => ({ id: 'v' + i, type: '视频', title: String(x.title).slice(0, 90), extra: `${x.stats?.views || 0} 播放 / ${x.author || ''}` })),
    ...posts.map((x, i) => ({ id: 'p' + i, type: '帖子', title: String(x.title).slice(0, 90), extra: `${x.platform} / 互动 ${(x.stats?.fav || 0) + (x.stats?.boost || 0) + (x.stats?.reply || 0) + (x.stats?.score || 0) + (x.stats?.comments || 0)}` })),
    ...articles.map((x, i) => ({ id: 'a' + i, type: '文章', title: String(x.title).slice(0, 90), extra: `${x.author || ''} / ${x.days >= 999 ? '日期未知' : x.days + ' 天前'}` })),
  ];
  if (!items.length) return { items: [] };

  const out = [];
  const via = [];
  let summary = '';
  // 分块审查：一次 10 条，避免输出被截断
  for (let i = 0; i < items.length; i += 10) {
    const chunk = items.slice(i, i + 10);
    const prompt = `你是外贸包装 B2B（${category}）的内容采购审查员。逐条判断下面候选内容对「做定制包装 B2B 内容营销」有没有用。
评分 0-100：80+ 直接可用；60-79 一般；<60 丢弃。判 drop 必须给具体原因（与包装无关 / 个人艺术创作 / 纯新闻无结构 / 语言不相关）。
候选：
${chunk.map((x) => `${x.id} [${x.type}] ${x.title} ｜ ${x.extra}`).join('\n')}
输出：{"items":[{"id":"v0","score":78,"verdict":"keep|drop","reason":"一句话"}],"summary":"一句话"}`;
    const r = await chat({ task: 'audit', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.2, maxTokens: 3200 });
    const obj = extractJson(r.content);
    if (obj?.items) out.push(...obj.items.filter((x) => x && x.id));
    if (obj?.summary && !summary) summary = obj.summary;
    if (r.via) via.push(r.via);
  }
  return { items: out, summary, via: via[0] || '', model: 'kimi-k3.1-pro' };
}

export async function auditKeywords({ category, groups = [] }) {
  const flat = [];
  groups.forEach((g, gi) => g.suggestions.forEach((kw, ki) => flat.push({ id: `k${gi}_${ki}`, kw, seed: g.seed })));
  if (!flat.length) return { items: [] };
  const prompt = `你是外贸 SEO 关键词审查员。类目：${category}（定制包装，B2B，欧美）。
下面是从 Google 联想词抓到的候选词，逐条判断是否值得放进内容关键词库。
评分 0-100：80+ 精准采购意图、可直接做选题；60-79 一般长尾；<60 建议丢弃。
必须丢的典型：带具体城市/州名（如 california、ankleshwar、near me）、明显是别的行业、纯品牌词、拼写错误。
输出 {"items":[{"id":"k0_1","score":72,"verdict":"keep|drop","reason":"一句话"}]}

候选：
${flat.map((x) => `${x.id} ${x.kw}`).join('\n')}`;

  const r = await chat({ task: 'audit', messages: [{ role: 'user', content: prompt + JSON_RULE }], temperature: 0.2, maxTokens: 2600 });
  const obj = extractJson(r.content);
  return { items: (obj?.items || []).filter((x) => x && x.id), via: r.via, model: r.model };
}
