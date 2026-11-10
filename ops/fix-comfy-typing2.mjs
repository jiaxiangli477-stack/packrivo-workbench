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

let fixed = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const hasPrepended = src.startsWith('from typing import List\n');
  const hasFuture = /^from __future__ import annotations$/m.test(src);
  if (!hasPrepended) continue;

  src = src.slice('from typing import List\n'.length);   // 先摘掉
  if (hasFuture) {
    src = src.replace(/^(from __future__ import annotations\n)/m, '$1from typing import List\n');
  } else {
    src = 'from typing import List\n' + src;
  }
  writeFileSync(f, src, 'utf8');
  fixed++;
  console.log('fixed', f.replace(root, ''));
}
console.log('files fixed:', fixed);
