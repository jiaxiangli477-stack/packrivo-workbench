import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { DATA_DIR } from './paths.mjs';

const KEY_FILE = path.join(DATA_DIR, 'master.key.dpapi');
let cachedKey = null;

function ps(script) {
  return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

function protect(b64) {
  return ps(`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String('${b64}'); $p=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'); [Convert]::ToBase64String($p)`);
}

function unprotect(b64) {
  return ps(`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String('${b64}'); $p=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'); [Convert]::ToBase64String($p)`);
}

export function masterKey() {
  if (cachedKey) return cachedKey;
  if (existsSync(KEY_FILE)) {
    const raw = readFileSync(KEY_FILE, 'utf8').trim();
    if (raw.startsWith('dpapi:')) {
      cachedKey = Buffer.from(unprotect(raw.slice(6)), 'base64');
      return cachedKey;
    }
    if (raw.startsWith('plain:')) {
      cachedKey = Buffer.from(raw.slice(6), 'base64');
      return cachedKey;
    }
  }
  const key = randomBytes(32);
  let stored;
  try {
    stored = 'dpapi:' + protect(key.toString('base64'));
  } catch {
    // 无 DPAPI 可用时退化为明文主密钥，启动日志会警告
    stored = 'plain:' + key.toString('base64');
    process.env.SWB_CRYPTO_WEAK = '1';
  }
  writeFileSync(KEY_FILE, stored, { mode: 0o600 });
  cachedKey = key;
  return key;
}

export function encrypt(plain) {
  const key = masterKey();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(String(plain), 'utf8')), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function decrypt(blob) {
  if (!blob) return '';
  const key = masterKey();
  const [v, ivB, tagB, ctB] = String(blob).split('.');
  if (v !== 'v1') throw new Error('unknown cipher version');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ctB, 'base64')), d.final()]).toString('utf8');
}

export function keyHint(secret) {
  const s = String(secret || '');
  return s.length <= 4 ? '****' : '…' + s.slice(-4);
}
