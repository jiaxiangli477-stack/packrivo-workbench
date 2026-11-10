/* 本机 API 的访问控制（SEC-02）。
   审计结论：8795 上的 /api/* 完全没有认证，任何能发 HTTP 请求的本地进程/网页都能改设置、发帖、读凭据状态；
   再叠加 DNS rebinding 与「表单跨站 POST」，浏览器页面也能借用户的本机服务动手。

   三层，缺一不可：
   1) Host 白名单 —— 只接受回环主机名，挡 DNS rebinding（攻击者域名解析到 127.0.0.1 时 Host 是他的域名）。
   2) 写操作 Origin 校验 —— 有 Origin 就必须是本服务的源；浏览器跨站表单/脚本一定带 Origin。
   3) 令牌 —— /swb-env.js 注入到页面，前端 api() 带 x-swb-token；外部进程要操作得先读 data/app-token.txt。
      令牌不是「防本机管理员」的，本机管理员本来就能读文件；它挡的是「同浏览器里别的站点」和「随手写的脚本」。

   豁免只有两类：静态资源/页面本身（含 /swb-env.js），以及 <img src> 无法带头的 /api/media/*。 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const TOKEN_FILE = 'app-token.txt';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PREFIXES = ['/api/media/', '/api/thumb', '/swb-env.js', '/favicon.ico'];
const EXEMPT_EXACT = new Set(['/api/health', '/api/ping']);

export function loadAppToken(dataDir, envToken = '') {
  const forced = String(envToken || '').trim();
  if (forced) return { token: forced, source: 'env', file: '' };
  const file = path.join(dataDir, TOKEN_FILE);
  if (existsSync(file)) {
    const t = readFileSync(file, 'utf8').trim();
    if (t.length >= 16) return { token: t, source: 'file', file };
  }
  const token = randomBytes(24).toString('hex');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(file, token + '\n', { mode: 0o600 });
  return { token, source: 'generated', file };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function defaultAllowHosts(extra = '') {
  const base = ['127.0.0.1', 'localhost', '::1'];
  const more = String(extra || '').split(',').map((s) => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
  return new Set([...base, ...more]);
}

function hostName(hostHeader) {
  const raw = String(hostHeader || '').trim();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end > 0 ? raw.slice(1, end) : raw;
  }
  const i = raw.lastIndexOf(':');
  return i > 0 ? raw.slice(0, i) : raw;
}

function isExempt(pathname) {
  if (EXEMPT_EXACT.has(pathname)) return true;
  if (EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  // 静态资源/页面本身豁免：只挡 /api/* 数据面，页面、脚本、样式等静态文件不用令牌
  // （token 由同源 /swb-env.js 注入，页面拿到后自然带；挡了反而把前端锁死）。
  if (!pathname.startsWith('/api/')) return true;
  return false;
}

/**
 * @returns {{ok:true, tokenOk:boolean}} | {{ok:false, status:number, code:string, message:string}}
 */
export function checkRequest(req, { token, allowHosts, port, requireToken = true } = {}) {
  const host = hostName(req.headers.host);
  const hosts = allowHosts instanceof Set ? allowHosts : defaultAllowHosts();
  if (!host) return deny(403, 'bad_host', '请求缺少 Host 头');
  if (!hosts.has(host.toLowerCase())) {
    return deny(403, 'bad_host', `Host 不在白名单：${host}（允许 ${[...hosts].join(' / ')}）`);
  }

  const method = String(req.method || 'GET').toUpperCase();
  if (WRITE_METHODS.has(method)) {
    const origin = String(req.headers.origin || '').trim();
    if (origin) {
      let ok = false;
      try {
        const u = new URL(origin);
        const oh = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        const samePort = !port || !u.port || Number(u.port) === Number(port);
        ok = (u.protocol === 'http:' || u.protocol === 'https:') && hosts.has(oh) && samePort;
      } catch { ok = false; }
      if (!ok) return deny(403, 'bad_origin', `跨站来源被拒绝：${origin}`);
    }
    const site = String(req.headers['sec-fetch-site'] || '');
    if (site && site !== 'same-origin' && site !== 'none') {
      return deny(403, 'bad_origin', `Sec-Fetch-Site=${site}，拒绝跨站写操作`);
    }
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    const hasBody = Number(req.headers['content-length'] || 0) > 0 || !!req.headers['transfer-encoding'];
    if (hasBody && !ct.startsWith('application/json')) {
      return deny(415, 'bad_content_type', `写操作只接受 application/json，收到 ${ct || '(空)'}`);
    }
  }

  if (!requireToken) return { ok: true, tokenOk: true };

  const fromHeader = String(req.headers['x-swb-token'] || '').trim();
  const authz = String(req.headers.authorization || '');
  const fromBearer = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : '';
  const given = fromHeader || fromBearer;
  if (!given) return deny(401, 'token_required', '缺少访问令牌（x-swb-token）');
  if (!token || !safeEqual(given, token)) return deny(401, 'token_invalid', '访问令牌不正确');
  return { ok: true, tokenOk: true };
}

export { isExempt };

function deny(status, code, message) {
  return { ok: false, status, code, message };
}
