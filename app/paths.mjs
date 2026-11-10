// 路径与数据目录：独立成模块，避免 db.mjs <-> crypto.mjs 的循环导入
// （crypto.mjs 顶层要 path.join(DATA_DIR, ...)，db.mjs 顶层要建表，循环会让 DATA_DIR 处于 TDZ）
import path from 'node:path';
import { mkdirSync } from 'node:fs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = process.env.SWB_DATA || path.join(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, 'workbench.db');
