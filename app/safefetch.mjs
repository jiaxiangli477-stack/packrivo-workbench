/* 安全外取（SEC-03）：只允许真正在公网上的 http(s) 目标。
   审计结论是「博客导入与缩略图代理直接 fetch 用户给的 URL」——原来只对 127./10./192.168. 做正则，
   IPv6、十进制/八进制点分、DNS 解析到内网、重定向到内网全都能穿过去。

   这里的做法不是靠字符串匹配，而是靠 node 的 lookup 钩子：连接前把域名解析结果逐个过 IP 分类，
   任何一个地址落在 loopback / 私有 / 链路本地 / 保留段就整条请求失败；重定向逐跳重新走同一套校验。

   注意：本模块只管「公网 URL」。管理员自己配的模型/接口地址（127.0.0.1 上的 LLM 网关）不走这里，
   那条链路的信任边界是「管理员亲手填的地址」，与用户提交的 URL 不同。 */

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT = 20000;

/* ---------- IP 分类 ---------- */
function ipv4Forbidden(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 10) return true;                         // 10/8
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local / 云元数据
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
  if (a === 192 && b === 168) return true;           // 192.168/16
  if (a === 192 && b === 0) return true;             // 192.0.0/24 + 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true;                         // 组播 + 保留 + 广播
  return false;
}

function ipv6Forbidden(ip) {
  const s = ip.toLowerCase().split('%')[0];
  // IPv4-mapped（::ffff:127.0.0.1）按 v4 规则判
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Forbidden(mapped[1]);
  if (s === '::' || s === '::1') return true;
  const head = s.split(':')[0] || '';
  const n = parseInt(head || '0', 16);
  if ((n & 0xfe00) === 0xfc00) return true;  // fc00::/7 ULA
  if ((n & 0xffc0) === 0xfe80) return true;  // fe80::/10 link-local
  if ((n & 0xff00) === 0xff00) return true;  // ff00::/8 组播
  return false;
}

export function ipForbidden(ip) {
  const fam = net.isIP(ip);
  if (fam === 4) return ipv4Forbidden(ip);
  if (fam === 6) return ipv6Forbidden(ip);
  return true;
}

/* ---------- 只连公网地址的 agent ---------- */
export function guardedAgent(protocol = 'http:') {
  const Mod = protocol === 'https:' ? https : http;
  return new Mod.Agent({
    keepAlive: false,
    lookup(hostname, opts, cb) {
      dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
        if (err) return cb(err);
        if (!addrs || !addrs.length) return cb(new Error('域名解析为空'));
        for (const a of addrs) {
          if (ipForbidden(a.address)) {
            return cb(new Error(`目标解析到内网/保留地址 ${a.address}，已拒绝`));
          }
        }
        const want = opts && opts.family ? addrs.find((a) => a.family === opts.family) : null;
        const pick = want || addrs[0];
        cb(null, pick.address, pick.family);
      });
    },
  });
}

/** 连接前先判一次；用于 URL 里的字面 IP 与协议白名单。 */
export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new Error('URL 格式非法'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('只允许 http/https');
  if (!u.hostname) throw new Error('URL 缺少主机名');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (ipForbidden(host)) throw new Error('拒绝访问内网/本机地址');
    return u;
  }
  if (/^localhost$/i.test(host)) throw new Error('拒绝访问 localhost');
  const addrs = await new Promise((res, rej) => dns.lookup(host, { all: true, verbatim: true }, (e, a) => (e ? rej(e) : res(a))));
  if (!addrs.length) throw new Error('域名解析为空');
  for (const a of addrs) if (ipForbidden(a.address)) throw new Error(`拒绝：${host} 解析到 ${a.address}`);
  return u;
}

/* ---------- 取文本 ---------- */
export async function safeFetchText(rawUrl, {
  timeoutMs = DEFAULT_TIMEOUT,
  maxBytes = 2 * 1024 * 1024,
  maxRedirects = MAX_REDIRECTS,
  acceptTypes = ['text/html', 'text/plain', 'application/xhtml+xml'],
  headers = { 'user-agent': 'Mozilla/5.0 (compatible; PackrivoBot/1.0)' },
} = {}) {
  let current = String(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const u = await assertPublicUrl(current);
    const res = await requestOnce(u, { timeoutMs, headers });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (!res.location) throw new Error(`HTTP ${res.status} 但没有 Location`);
      current = new URL(res.location, u).href;
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status);
    const ct = String(res.contentType || '').split(';')[0].trim().toLowerCase();
    if (ct && !acceptTypes.includes(ct)) throw new Error(`内容类型不允许：${ct}（只接受 ${acceptTypes.join(' / ')}）`);
    if (res.bytes > maxBytes) throw new Error(`响应超过 ${Math.round(maxBytes / 1024)}KB 上限`);
    return { url: u.href, status: res.status, contentType: ct, text: res.body.toString('utf8'), bytes: res.bytes };
  }
  throw new Error(`重定向超过 ${maxRedirects} 次`);
}

/* 取二进制（缩略图代理）：同样逐跳判内网，按 content-type 前缀与体积上限卡死。 */
export async function safeFetchBinary(rawUrl, {
  timeoutMs = DEFAULT_TIMEOUT,
  maxBytes = 3 * 1024 * 1024,
  maxRedirects = MAX_REDIRECTS,
  acceptPrefix = 'image/',
  headers = { 'user-agent': 'Mozilla/5.0 (compatible; PackrivoBot/1.0)' },
} = {}) {
  let current = String(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const u = await assertPublicUrl(current);
    const res = await requestOnce(u, { timeoutMs, headers });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (!res.location) throw new Error(`HTTP ${res.status} 但没有 Location`);
      current = new URL(res.location, u).href;
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status);
    const ct = String(res.contentType || '').split(';')[0].trim().toLowerCase();
    if (acceptPrefix && !ct.startsWith(acceptPrefix)) throw new Error(`内容类型不允许：${ct || '(空)'}（只接受 ${acceptPrefix}*）`);
    if (res.bytes > maxBytes) throw new Error(`响应超过 ${Math.round(maxBytes / 1024)}KB 上限`);
    return { url: u.href, status: res.status, contentType: ct, buf: res.body, bytes: res.bytes };
  }
  throw new Error(`重定向超过 ${maxRedirects} 次`);
}

/* 只探活：只要 HTTP 状态，正文读满 64KB 就断开。用于「保存产品前先看落地页通不通」，
   这条路以前用的是裸 fetch + follow，填个内网地址就成了内网探针。 */
export async function safeProbe(rawUrl, { timeoutMs = 8000, maxRedirects = MAX_REDIRECTS, capBytes = 64 * 1024 } = {}) {
  let current = String(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const u = await assertPublicUrl(current);
    const res = await requestOnce(u, { timeoutMs, headers: { 'user-agent': 'Mozilla/5.0' }, capBytes });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (!res.location) return { url: u.href, status: res.status };
      current = new URL(res.location, u).href;
      continue;
    }
    return { url: u.href, status: res.status, contentType: String(res.contentType || '').split(';')[0].trim().toLowerCase() };
  }
  throw new Error(`重定向超过 ${maxRedirects} 次`);
}

function requestOnce(u, { timeoutMs, headers, capBytes = 0 }) {
  return new Promise((resolve, reject) => {
    const Mod = u.protocol === 'https:' ? https : http;
    const agent = guardedAgent(u.protocol);
    const req = Mod.request({
      protocol: u.protocol,
      hostname: u.hostname.replace(/^\[|\]$/g, ''),
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers,
      agent,
    }, (res) => {
      const chunks = [];
      let bytes = 0;
      let settled = false;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > 6 * 1024 * 1024) { req.destroy(new Error('响应过大，已中断')); return; }
        chunks.push(c);
        if (capBytes && bytes >= capBytes && !settled) {
          settled = true;
          res.destroy();
          agent.destroy();
          resolve({
            status: res.statusCode || 0,
            contentType: res.headers['content-type'] || '',
            location: res.headers.location || '',
            body: Buffer.concat(chunks),
            bytes,
          });
        }
      });
      res.on('end', () => {
        if (settled) return;
        settled = true;
        agent.destroy();
        resolve({
          status: res.statusCode || 0,
          contentType: res.headers['content-type'] || '',
          location: res.headers.location || '',
          body: Buffer.concat(chunks),
          bytes,
        });
      });
      res.on('error', (e) => { if (settled) return; settled = true; agent.destroy(); reject(e); });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`读取超时（${timeoutMs}ms）`)));
    req.on('error', (e) => { agent.destroy(); reject(e); });
    req.end();
  });
}
