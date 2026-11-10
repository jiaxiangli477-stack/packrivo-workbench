import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/radar.mjs';
let c = readFileSync(p, 'utf8');
const oldLine = "    posts: uniq(posts).filter((x) => !exclude.has(x.url)).filter((x) => industryOk((x.title || '') + ' ' + (x.snippet || ''))).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),";
const newLine = "    posts: uniq(posts)\n      .filter((x) => !exclude.has(x.url))\n      .filter((x) => industryOk((x.title || '') + ' ' + (x.snippet || '')))\n      .filter((x) => {\n        const e = x.platform === 'lemmy'\n          ? (x.stats.score || 0) + (x.stats.comments || 0)\n          : (x.stats.fav || 0) + (x.stats.boost || 0) + (x.stats.reply || 0);\n        return e >= (x.platform === 'lemmy' ? 10 : 3);\n      })\n      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),";
if (c.includes(oldLine)) { c = c.replace(oldLine, newLine); writeFileSync(p, c, 'utf8'); console.log('engagement filter added to reroll path'); }
else console.log('anchor missing');