import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/deploy/postiz/docker-compose.yml';
const lines = readFileSync(p, 'utf8').split('\n');
// 找到 command: 那一行（可能非常长），替换成 boot.sh 挂载 + 调用
const idx = lines.findIndex((l) => l.trim().startsWith('command:'));
if (idx < 0) { console.log('no command line'); process.exit(1); }
const indent = lines[idx].match(/^\s*/)[0];
const replacement = [
  indent + '# 由 boot.sh 负责：起 nginx、等 temporal、prisma push、pm2 拉起三个 app，并常驻',
  indent + 'command: ["sh", "/boot.sh"]',
];
lines.splice(idx, 1, ...replacement);
// 在 volumes 段末尾加 boot.sh 挂载
const volIdx = lines.findIndex((l) => l.trim() === '- postiz-uploads:/uploads/');
if (volIdx < 0) { console.log('no volume anchor'); process.exit(1); }
lines.splice(volIdx + 1, 0, indent + '- ./boot.sh:/boot.sh:ro');
writeFileSync(p, lines.join('\n'), 'utf8');
console.log('compose updated: boot.sh');