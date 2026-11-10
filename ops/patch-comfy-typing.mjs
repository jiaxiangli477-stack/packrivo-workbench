import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'E:/Ai/Python311/Lib/site-packages/comfy_kitchen';
let files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith('.py')) files.push(p);
  }
})(root);

let changed = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  if (!/\blist\[/.test(src)) continue;
  const before = src;
  // 内置泛型 → typing 泛型（torch 的 infer_schema 只认 typing.List）
  src = src.replace(/\blist\[/g, 'List[');
  if (!/from typing import[^\n]*\bList\b/.test(src)) {
    if (/^from typing import /m.test(src)) {
      src = src.replace(/^from typing import (.+)$/m, (m, names) => `from typing import ${names}, List`);
    } else {
      src = 'from typing import List\n' + src;
    }
  }
  if (src !== before) {
    writeFileSync(f, src, 'utf8');
    changed++;
    console.log('patched', f.replace(root, ''));
  }
}
console.log('files patched:', changed);
