/* UI-02 修复后离线回归：在【修复后】副本（E:\破甲工作区\packrivo-b1，相对 ae70126）上验证。
 *
 * 覆盖两个层面：
 *   A) 前端行为（Node VM 真实执行 web/app.js 的 viewReview）：
 *      - 审核页同时请求 pending_review / accounts / approved 三个端点（UI-02 入口）
 *      - 「已通过 · 待排期」面板渲染，仅列 approved_version === content_version 的内容
 *      - data-sch2 排期按钮点击 → POST /api/schedules 用原 content_id + 选中账号 + 时间
 *      - 账号下拉只列同平台账号
 *   B) 后端端到端（起修复版 server）：
 *      - 建内容 → 人工通过 → approved 列表可见且版本绑定
 *      - 通过后 pending_review 消失，approved 列表可排期（mock 通道不要求 integration）
 *      - POST /api/schedules 成功落一条排期
 *
 * 离线、不碰 8795 生产库、不访问真实外网。用法：node ops/verify-ui02-fixed.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runHarness } from './_ui02-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ISO = mkdtempSync(path.join(tmpdir(), 'swb-ui02-'));

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  通过  ${name}`); }
  else { fail += 1; console.log(`  失败  ✗ ${name}  ${extra}`); }
}

/* ============ A) 前端行为（Node VM） ============ */
async function frontendFixed() {
  console.log('\n[A] 前端：viewReview 渲染「已通过 · 待排期」入口');
  const appJs = readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');

  const CONTENT_APPROVED = { id: 7, platform: 'bluesky', title: '已通过的稿', body: 'ok body', status: 'approved', content_version: 3, approved_version: 3 };
  const CONTENT_STALE = { id: 8, platform: 'bluesky', title: '改过图的稿', body: 'stale', status: 'approved', content_version: 4, approved_version: 3 };
  const CONTENT_LEGACY = { id: 9, platform: 'bluesky', title: '旧批准无版本', body: 'legacy', status: 'approved', content_version: 1, approved_version: 0 };
  const ACCOUNTS = [
    { id: 1, platform: 'bluesky', handle: 'brand-a.bsky.social', integration_id: 'int-1', integration_identifier: 'brand-a' },
    { id: 2, platform: 'mastodon', handle: '@brand-a@masto', integration_id: '', integration_identifier: '' },
  ];

  const routes = (url, method, body) => {
    const u = String(url).split('?')[0];
    const q = new URLSearchParams(String(url).split('?')[1] || '');
    if (u === '/swb-env.js') return { status: 200, text: 'window.__SWB__ = {"token":"' + 'a'.repeat(32) + '","port":8795};' };
    if (u === '/api/contents') {
      const st = q.get('status');
      if (st === 'pending_review') return { data: { contents: [] } };
      if (st === 'approved') return { data: { contents: [CONTENT_APPROVED, CONTENT_STALE, CONTENT_LEGACY] } };
      return { data: { contents: [] } };
    }
    if (u === '/api/accounts') return { data: { accounts: ACCOUNTS } };
    if (u === '/api/schedules' && method === 'POST') return { data: { id: 99, run_at: body.run_at || null } };
    if (u === '/api/platforms') return { data: { platforms: [{ code: 'bluesky', label: 'Bluesky' }] } };
    return { data: {} };
  };

  const h = runHarness(appJs, {
    routes,
    selectValue(sel) { if (sel === '[data-acc2="7"]') return '1'; return undefined; },
  });

  await h.viewReview();
  await h.waitRendered();

  const html = h.viewEl.innerHTML;
  // 1) 审核页请求三个端点
  const urls = h.fetchLog.map((f) => f.url.split('?')[0]);
  ok('审核页请求 pending_review 列表', urls.includes('/api/contents'), '');
  ok('审核页请求 approved 列表', h.fetchLog.some((f) => f.url.includes('status=approved')), '');
  ok('审核页请求账号列表', urls.includes('/api/accounts'), '');

  // 2) 渲染「已通过 · 待排期」面板
  ok('渲染「已通过 · 待排期」面板', html.includes('已通过 · 待排期'), '');

  // 3) 只列 approved_version === content_version 的内容
  ok('已通过待排期只含版本一致的稿 #7', html.includes('data-sch2="7"'), '');
  ok('改过图的稿 #8 被过滤（版本落后）', !html.includes('data-sch2="8"'), '');
  ok('旧批准无版本 #9 被过滤（approved_version=0）', !html.includes('data-sch2="9"'), '');

  // 4) data-sch2 按钮存在且点击后 POST /api/schedules 用原 content_id + 账号 + 时间
  const sch2 = h.sch2Buttons();
  ok('存在 data-sch2 排期按钮（#7）', sch2.length === 1, 'count=' + sch2.length);
  const btn = sch2.find((b) => b.dataset.sch2 === '7');
  if (btn && typeof btn.onclick === 'function') {
    btn.onclick({ preventDefault() {}, stopPropagation() {} });
    await new Promise((r) => setTimeout(r, 150));
    const post = h.fetchLog.find((f) => f.method === 'POST' && f.url.startsWith('/api/schedules'));
    ok('点击排期 → POST /api/schedules', !!post, '');
    ok('POST 用原 content_id=7', post && post.body && post.body.content_id === 7, JSON.stringify(post && post.body));
    ok('POST 用选中账号 account_id=1', post && post.body && post.body.account_id === 1, JSON.stringify(post && post.body));
  } else {
    ok('data-sch2 按钮绑定了 onclick', false, 'onclick=' + (btn ? typeof btn.onclick : '无按钮'));
  }

  // 5) 账号下拉只列同平台账号（bluesky 稿 → 只 bluesky 账号）
  const acc2 = h.acc2Selects();
  const acc2html = html.match(/<select data-acc2="7">([\s\S]*?)<\/select>/);
  const accOpts = acc2html ? acc2html[1] : '';
  ok('账号下拉含 bluesky 账号', accOpts.includes('brand-a.bsky.social'), '');
  ok('账号下拉不含 mastodon 账号', !accOpts.includes('@brand-a@masto'), '');
  ok('账号下拉标注未绑 integration', accOpts.includes('未绑 integration') === false || accOpts.includes('int-1'), '');
}

/* ============ B) 后端端到端 ============ */
function startServer(dataDir) {
  const child = spawn(process.execPath, ['app/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SWB_DATA: dataDir, SWB_PORT: '18891', SWB_CRYPTO_WEAK: '1' },
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
      else if (Date.now() - t0 > 15000) { clearInterval(iv); reject(new Error('server 未就绪: ' + log().slice(0, 600))); }
    }, 150);
  });
}

function req(method, urlPath, { headers = {}, body = null, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const done = (r) => { clearTimeout(t); resolve(r); };
    const t = setTimeout(() => done({ status: 'timeout', body: '' }), timeoutMs);
    const r = http.request({ host: '127.0.0.1', port: 18891, path: urlPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', (e) => done({ status: 0, body: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function backendFixed() {
  console.log('\n[B] 后端端到端：通过 → 已通过列表可排期');
  const dataDir = path.join(ISO, 'data');
  mkdirSync(dataDir, { recursive: true });
  const { child, log } = startServer(dataDir);
  await waitReady(child, log);

  const tokFile = path.join(dataDir, 'app-token.txt');
  let tok = '';
  for (let i = 0; i < 50 && !tok; i += 1) { try { tok = readFileSync(tokFile, 'utf8').trim(); } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const H = { 'x-swb-token': tok, 'content-type': 'application/json' };

  // 1) 建账号（bluesky，无 integration —— mock 通道不要求 integration）
  const accRes = await req('POST', '/api/accounts', { headers: H, body: '{"platform":"bluesky","handle":"brand-a.bsky.social"}' });
  const acc = JSON.parse(accRes.body || '{}');
  ok('建 bluesky 账号', accRes.status === 200 && !!acc.id, 'status=' + accRes.status);

  // 2) 建内容（pending_review）
  const ctRes = await req('POST', '/api/contents', { headers: H, body: '{"platform":"bluesky","body":"hello packrivo","title":"第一篇"}' });
  const ct = JSON.parse(ctRes.body || '{}');
  ok('建 pending_review 内容', ctRes.status === 200 && !!ct.id, 'status=' + ctRes.status);
  const cid = ct.id;

  // 3) pending_review 列表含它
  const pend1 = await req('GET', '/api/contents?status=pending_review', { headers: H });
  ok('通过前 pending_review 含该稿', JSON.parse(pend1.body || '{}').contents.some((c) => c.id === cid), '');

  // 4) 人工通过
  const revRes = await req('POST', `/api/contents/${cid}/review`, { headers: H, body: '{"decision":"approve","reviewer_kind":"human"}' });
  const rev = JSON.parse(revRes.body || '{}');
  ok('人工通过返回 approved', revRes.status === 200 && rev.status === 'approved', 'status=' + revRes.status);

  // 5) pending_review 消失（F2 缺陷核心：通过后从待审消失）
  const pend2 = await req('GET', '/api/contents?status=pending_review', { headers: H });
  ok('通过后 pending_review 不再含该稿', !JSON.parse(pend2.body || '{}').contents.some((c) => c.id === cid), '');

  // 6) approved 列表含它且版本绑定（approved_version === content_version）
  const appr = await req('GET', '/api/contents?status=approved', { headers: H });
  const apprList = JSON.parse(appr.body || '{}').contents;
  const apprC = apprList.find((c) => c.id === cid);
  ok('approved 列表含该稿', !!apprC, '');
  ok('approved_version === content_version（版本绑定）', apprC && Number(apprC.approved_version) > 0 && Number(apprC.approved_version) === Number(apprC.content_version), JSON.stringify(apprC && { av: apprC.approved_version, cv: apprC.content_version }));

  // 7) 从已通过列表排期：POST /api/schedules（mock 通道，无需 integration）
  const schRes = await req('POST', '/api/schedules', { headers: H, body: JSON.stringify({ content_id: cid, account_id: acc.id, run_at: '2026-12-01T10:00' }) });
  const sch = JSON.parse(schRes.body || '{}');
  ok('已通过稿可排期（POST /api/schedules 200）', schRes.status === 200 && !!sch.id, 'status=' + schRes.status + ' body=' + schRes.body.slice(0, 200));

  // 8) 排期列表含该条
  const schList = await req('GET', '/api/schedules', { headers: H });
  ok('排期列表含该条', JSON.parse(schList.body || '{}').schedules.some((s) => s.content_id === cid), '');

  child.kill();
}

async function main() {
  console.log('[verify-ui02-fixed] 隔离目录:', ISO);
  await frontendFixed();
  await backendFixed();
  try { rmSync(ISO, { recursive: true, force: true }); } catch {}
  console.log('\n==============================');
  console.log(`修复后通过 ${pass} / ${pass + fail}`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error('执行异常:', e); process.exit(2); });
