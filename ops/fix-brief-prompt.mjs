import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(p, 'utf8');
const old = '3. ${style}。';
const neu = '3. ${style}。\n${brief ? `3.5 内容简报（必须照这个角度写）：角度=${brief.angle || ""}；钩子=${brief.hook || ""}；结构=${(brief.structure || []).join(" / ")}；证据点=${(brief.proof || []).join(" / ")}；CTA=${brief.cta || ""}` : ""}';
if (!c.includes(old)) { console.log('MISS'); process.exit(1); }
c = c.replace(old, () => neu);
writeFileSync(p, c, 'utf8');
console.log('brief injected into prompt');