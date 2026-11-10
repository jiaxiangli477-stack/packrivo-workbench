import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/service/sd_server.py';
let s = readFileSync(p, 'utf8');
// 用 CPU offload，避免 6G 显存 OOM；预算压到 512x640
s = s.replace('        pipe = pipe.to("cuda")', '        pipe.enable_model_cpu_offload()')
     .replace('        budget = 640 * 800', '        budget = 512 * 640')
     .replace('        width = int(req.get("width") or 576)\n        height = int(req.get("height") or 720)',
              '        width = int(req.get("width") or 512)\n        height = int(req.get("height") or 640)')
     .replace('        steps = int(req.get("steps") or 25)', '        steps = int(req.get("steps") or 20)');
writeFileSync(p, s, 'utf8');
console.log('sd_server patched: cpu offload, 512x640 budget');