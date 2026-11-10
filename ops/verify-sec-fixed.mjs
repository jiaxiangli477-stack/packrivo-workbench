// SEC-01/02/03 修复后离线安全回归：在【修复后】副本（E:\破甲工作区\packrivo-b1，相对 ae70126）上验证。
// 运行位置：E:\破甲工作区\packrivo-b1，node ops/verify-sec-fixed.mjs
// 覆盖两个层面：
//   A) 单元层：auth.checkRequest / safefetch.ipForbidden / safefetch.assertPublicUrl（不依赖 server 起进程）
//   B) HTTP 端到端：起修复版 server，验证 401/403/415/回环拒绝/凭据不落明文
// 离线、不碰 8795 生产库、不访问真实外网。
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ISO = mkdtempSync(path.join(tmpdir(), 'swb-secfixed-'));

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  通过  ${name}`); }
  else { fail += 1; console.log(`  失败  ✗ ${name}  ${extra}`); }
}

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!['node_modules', '.git', 'data', 'data-fixed-http'].includes(e)) out = out.concat(walk(p)); }
    else if (/\.(mjs|js|json|md|txt|html)$/i.test(e)) out.push(p);
  }
  return out;
}

function startServer(dataDir) {
  const child = spawn(process.execPath, ['app/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SWB_DATA: dataDir, SWB_PORT: '18890', SWB_CRYPTO_WEAK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return { child, log: () => log };
}

function waitReady(child, log) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (log().includes('[social-workbench] http://')) { clearInterval(iv); resolve(); }
      else if (Date.now() - t0 > 15000) { clearInterval(iv); reject(new Error('server 未就绪: ' + log().slice(0, 500))); }
    }, 150);
  });
}

function req(method, urlPath, { headers = {}, body = null, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const done = (r) => { clearTimeout(t); resolve(r); };
    const t = setTimeout(() => done({ status: 'timeout', body: '' }), timeoutMs);
    const r = http.request({ host: '127.0.0.1', port: 18890, path: urlPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', (e) => done({ status: 0, body: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  console.log('[verify-sec-fixed] 隔离目录:', ISO);

  // ============ A) 单元层 ============
  console.log('\n[A1] SEC-01：源码/文档无完整明文密钥');
  const SECRET_RE = /sk-[A-Za-z0-9_-]{20,}|xoxb-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}/;
  const POSTIZ_FULL = 'e77fa996b6a61d4d15' + 'fbe4d63ebeab8ef8ab0c86755e3a4977213419df87348f';
  const files = walk(ROOT);
  const secretHits = [];
  for (const f of files) {
    const c = readFileSync(f, 'utf8');
    if (SECRET_RE.test(c) || c.includes(POSTIZ_FULL)) secretHits.push(path.relative(ROOT, f));
  }
  ok('源码/文档无完整明文密钥', secretHits.length === 0, '→ ' + secretHits.join(', '));
  const probeKey = readFileSync(path.join(ROOT, 'ops', '_probe-cloud-endpoints.mjs'), 'utf8');
  ok('ops/_probe-cloud-endpoints.mjs 改读环境变量', probeKey.includes('process.env.POSTIZ_PROBE_KEY') && !probeKey.includes("const KEY = 'e77fa996"), '');

  console.log('\n[A2] SEC-02：auth.checkRequest 单元断言');
  const auth = await import('../app/auth.mjs');
  const token = 'A'.repeat(32);
  const allowHosts = auth.defaultAllowHosts('');
  const mkReq = (o) => ({ method: 'GET', headers: { host: '127.0.0.1', ...o } });
  ok('缺 token → 401', auth.checkRequest(mkReq({}), { token, allowHosts }).status === 401);
  ok('错 token → 401', auth.checkRequest(mkReq({ 'x-swb-token': 'bad' }), { token, allowHosts }).status === 401);
  ok('对 token → 放行', auth.checkRequest(mkReq({ 'x-swb-token': token }), { token, allowHosts }).ok === true);
  ok('恶意 Host → 403', auth.checkRequest(mkReq({ host: 'evil.example.com' }), { token, allowHosts }).status === 403);
  ok('伪 Origin 写 → 403', auth.checkRequest({ method: 'POST', headers: { host: '127.0.0.1', origin: 'https://evil.example.com', 'x-swb-token': token, 'content-type': 'application/json' } }, { token, allowHosts }).status === 403);
  ok('非 JSON 写 → 415', auth.checkRequest({ method: 'POST', headers: { host: '127.0.0.1', 'x-swb-token': token, 'content-type': 'text/plain', 'content-length': '5' } }, { token, allowHosts }).status === 415);
  ok('同源 Origin 写 → 放行', auth.checkRequest({ method: 'POST', headers: { host: '127.0.0.1', origin: 'http://127.0.0.1:18890', 'x-swb-token': token, 'content-type': 'application/json' } }, { token, allowHosts, port: 18890 }).ok === true);

  console.log('\n[A3] SEC-03：safefetch IP 分类与 URL 断言');
  const sf = await import('../app/safefetch.mjs');
  ok('ipForbidden 拦 127.0.0.1', sf.ipForbidden('127.0.0.1') === true);
  ok('ipForbidden 拦 10.x', sf.ipForbidden('10.0.0.1') === true);
  ok('ipForbidden 拦 192.168.x', sf.ipForbidden('192.168.1.1') === true);
  ok('ipForbidden 拦 169.254.169.254', sf.ipForbidden('169.254.169.254') === true);
  ok('ipForbidden 拦 172.16.x', sf.ipForbidden('172.16.0.1') === true);
  ok('ipForbidden 拦 ::1', sf.ipForbidden('::1') === true);
  ok('ipForbidden 拦 ::ffff:127.0.0.1', sf.ipForbidden('::ffff:127.0.0.1') === true);
  ok('ipForbidden 放行公网 8.8.8.8', sf.ipForbidden('8.8.8.8') === false);
  let threwLoop = false; try { await sf.assertPublicUrl('http://127.0.0.1/x'); } catch { threwLoop = true; }
  ok('assertPublicUrl 拒字面回环', threwLoop);
  let threwLocalhost = false; try { await sf.assertPublicUrl('http://localhost/x'); } catch { threwLocalhost = true; }
  ok('assertPublicUrl 拒 localhost', threwLocalhost);
  let threwProto = false; try { await sf.assertPublicUrl('file:///etc/passwd'); } catch { threwProto = true; }
  ok('assertPublicUrl 拒非 http(s)', threwProto);

  // ============ B) HTTP 端到端 ============
  console.log('\n[B] HTTP 端到端：起修复版 server');
  const dataDir = path.join(ISO, 'data');
  mkdirSync(dataDir, { recursive: true });
  const { child, log } = startServer(dataDir);
  await waitReady(child, log);
  const tokFile = path.join(dataDir, 'app-token.txt');
  // 等 token 文件生成
  let tok = '';
  for (let i = 0; i < 50 && !tok; i += 1) { try { tok = readFileSync(tokFile, 'utf8').trim(); } catch { await new Promise((r) => setTimeout(r, 100)); } }
  ok('启动生成 app-token.txt', tok.length >= 16, 'tok=' + tok.length);

  const readNoToken = await req('GET', '/api/settings');
  ok('无 token 读设置 → 401', readNoToken.status === 401, 'status=' + readNoToken.status);

  const readOk = await req('GET', '/api/settings', { headers: { 'x-swb-token': tok } });
  ok('带 token 读设置 → 200', readOk.status === 200, 'status=' + readOk.status);

  const writeForged = await req('PUT', '/api/settings', {
    headers: { origin: 'https://untrusted.example', 'content-type': 'application/json', 'x-swb-token': tok },
    body: '{"brand_name":"__PWN__"}',
  });
  ok('伪 Origin 写 → 403', writeForged.status === 403, 'status=' + writeForged.status);

  const writePlain = await req('PUT', '/api/settings', {
    headers: { 'content-type': 'text/plain', 'x-swb-token': tok },
    body: '{"brand_name":"__PWN__"}',
  });
  ok('text/plain 写 → 415', writePlain.status === 415, 'status=' + writePlain.status);

  const writeSameOrigin = await req('PUT', '/api/settings', {
    headers: { origin: 'http://127.0.0.1:18890', 'content-type': 'application/json', 'x-swb-token': tok },
    body: '{"brand_name":"__OK__"}',
  });
  ok('同源 Origin + token 写 → 200', writeSameOrigin.status === 200, 'status=' + writeSameOrigin.status);

  // SEC-03 端到端：本地 fixture 不应被访问
  let fixtureHit = 0;
  const fixture = http.createServer((req2, res2) => { fixtureHit += 1; res2.writeHead(200, { 'content-type': 'text/html' }); res2.end('<html><h1>internal</h1></html>'); });
  await new Promise((res) => fixture.listen(18882, '127.0.0.1', res));

  const impLoop = await req('POST', '/api/blog/import', {
    headers: { 'content-type': 'application/json', 'x-swb-token': tok },
    body: '{"url":"http://127.0.0.1:18882/internal"}',
    timeoutMs: 8000,
  });
  ok('blog/import 回环 → 400 拒绝（不挂起）', impLoop.status === 400, 'status=' + impLoop.status);
  await new Promise((r) => setTimeout(r, 300));
  ok('本地 fixture 未被访问（SSRF 阻断）', fixtureHit === 0, 'fixtureHit=' + fixtureHit);

  const impLocalhost = await req('POST', '/api/blog/import', {
    headers: { 'content-type': 'application/json', 'x-swb-token': tok },
    body: '{"url":"http://localhost:18882/"}',
    timeoutMs: 8000,
  });
  ok('blog/import localhost → 400 拒绝', impLocalhost.status === 400, 'status=' + impLocalhost.status);

  fixture.close();
  child.kill();
  try { rmSync(ISO, { recursive: true, force: true }); } catch {}

  console.log('\n==============================');
  console.log(`修复后通过 ${pass} / ${pass + fail}`);
  console.log('==============================');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('[verify-sec-fixed] 失败:', e); process.exit(2); });
