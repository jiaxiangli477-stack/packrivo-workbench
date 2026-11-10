import { readFileSync, writeFileSync } from 'node:fs';
// sd_server：限制最大像素，避免 6G 显存 OOM
const p = 'E:/破甲工作区/social-workbench/service/sd_server.py';
let s = readFileSync(p, 'utf8');
const old = `        width = int(req.get("width") or 768)
        height = int(req.get("height") or 960)`;
const neu = `        width = int(req.get("width") or 576)
        height = int(req.get("height") or 720)
        # 6G 显存：超过 640x800 容易 OOM，按比例压下来
        budget = 640 * 800
        if width * height > budget:
            import math
            k = math.sqrt(budget / float(width * height))
            width = max(384, int(width * k) // 8 * 8)
            height = max(384, int(height * k) // 8 * 8)`;
if (!s.includes(old)) { console.log('MISS sd_server'); process.exit(1); }
s = s.replace(old, () => neu);
writeFileSync(p, s, 'utf8');
console.log('sd_server: resolution clamped');

// 工作台：默认出图尺寸调小到 640 基准
const sp = 'E:/破甲工作区/social-workbench/app/server.mjs';
let c = readFileSync(sp, 'utf8');
c = c.split('const base = 1024;').join('const base = 640;');
writeFileSync(sp, c, 'utf8');
console.log('server: base size 640');