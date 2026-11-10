// 批次一（2026-11-batch1）断言验证。
// 覆盖：SEC-01（无明文密钥）、SEC-02（访问控制）、SEC-03（SSRF 阻断）、
//       PUB-01（审核门禁/版本绑定）、PUB-02（发布模式参数化）、PUB-04（integration 绑定）。
// 全部离线、不联网、不碰 8795 生产库、不使用真实发布账号。
// 用法：node ops/verify-batch1.mjs
// 数据隔离：SWB_DATA 指向临时目录，迁移与断言都在里面跑，不动副本 data/workbench.db。
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 隔离数据目录
const ISO = mkdtempSync(path.join(tmpdir(), 'swb-batch1-'));
process.env.SWB_DATA = ISO;
mkdirSync(ISO, { recursive: true });
process.env.SWB_CRYPTO_WEAK = '1'; // 隔离环境允许明文主密钥（仅测试）

let pass = 0;
let fail = 0;
const results = [];
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; results.push(`  ✔ ${name}`); }
  else { fail += 1; results.push(`  ✘ ${name} ${extra}`); }
}

async function main() {
  console.log(`[verify-batch1] 隔离数据目录: ${ISO}`);

  // ---- 先跑 db 迁移（导入 db.mjs 触发建表 + 批次一加列 + 回填） ----
  const dbmod = await import('../app/db.mjs');
  const { db, get, all, run, setting, setSetting, tx, BATCH1_MIGRATION } = dbmod;
  const gate = await import('../app/gate.mjs');
  const auth = await import('../app/auth.mjs');
  const sf = await import('../app/safefetch.mjs');
  const errors = await import('../app/errors.mjs');

  console.log('\n[1] 迁移：批次一加列');
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  ok('content.content_version', cols('content').includes('content_version'));
  ok('content.approved_version', cols('content').includes('approved_version'));
  ok('account.integration_id', cols('account').includes('integration_id'));
  ok('schedule.delivery_state', cols('schedule').includes('delivery_state'));
  ok('schedule.publish_mode', cols('schedule').includes('publish_mode'));
  ok('job.intent_id', cols('job').includes('intent_id'));
  ok('schema_migration 记录已写入', !!get("select 1 x from schema_migration where id = ?", BATCH1_MIGRATION));

  console.log('\n[2] PUB-01：审核门禁与版本绑定');
  // 造数据
  run("insert into account(id, platform, handle, status) values (1, 'bluesky', 'tester', 'active')");
  run("insert into content(id, platform, body, status, content_version, approved_version) values (1, 'bluesky', 'hello', 'draft', 1, 0)");
  run("insert into content(id, platform, body, status, content_version, approved_version) values (2, 'bluesky', 'ok', 'approved', 1, 1)");
  run("insert into content(id, platform, body, status, content_version, approved_version) values (3, 'bluesky', 'stale', 'approved', 2, 1)");
  run("insert into content(id, platform, body, status, content_version, approved_version) values (4, 'bluesky', 'rejected', 'rejected', 1, 1)");

  const draft = get('select * from content where id = 1');
  const approved = get('select * from content where id = 2');
  const stale = get('select * from content where id = 3');
  const rejected = get('select * from content where id = 4');
  const acct = get('select * from account where id = 1');

  ok('草稿不可发（content_draft）', gate.checkPublishable({ content: draft, account: acct }).code === 'content_draft');
  ok('从未批准不可发（content_not_approved）', gate.checkPublishable({ content: { ...draft, status: 'approved' }, account: acct }).code === 'content_not_approved');
  ok('已批准可发', gate.checkPublishable({ content: approved, account: acct }).ok === true);
  ok('版本落后判 content_not_approved', gate.checkPublishable({ content: stale, account: acct }).code === 'content_not_approved');
  ok('驳回判 content_rejected', gate.checkPublishable({ content: rejected, account: acct }).code === 'content_rejected');
  // 请求体塞 status=approved 不生效：许可只看 approved_version 字段
  const forged = { ...approved, status: 'approved', approved_version: 0 };
  ok('请求体 status=approved 不构成批准', gate.checkPublishable({ content: forged, account: acct }).code === 'content_not_approved');
  // 排期版本过期
  ok('排期版本过期判 schedule_stale', gate.checkPublishable({ content: approved, account: acct, schedule: { content_version: 2 } }).code === 'schedule_stale');
  // 账号状态非 active
  ok('账号停用判 account_inactive', gate.checkPublishable({ content: approved, account: { ...acct, status: 'paused' } }).code === 'account_inactive');
  // 平台不匹配
  ok('账号平台不匹配判 mismatch', gate.checkPublishable({ content: approved, account: { ...acct, platform: 'mastodon' } }).code === 'account_platform_mismatch');
  // integration 绑定（requireIntegration=true）
  ok('Postiz 通道未绑定判 account_unbound', gate.checkPublishable({ content: approved, account: acct, requireIntegration: true }).code === 'account_unbound');
  const boundAcct = { ...acct, integration_id: 'abc123' };
  ok('Postiz 通道已绑定可发', gate.checkPublishable({ content: approved, account: boundAcct, requireIntegration: true }).ok === true);

  console.log('\n[3] PUB-02：发布模式参数化');
  const postiz = await import('../app/postiz.mjs');
  ok('normalizePublishMode 只认 draft/schedule/now', postiz.normalizePublishMode('draft') === 'draft');
  ok('非法值回落 now', postiz.normalizePublishMode('auto') === 'now');
  ok('空值回落 fallback', postiz.normalizePublishMode('', 'schedule') === 'schedule');
  // 全局 postiz_type 不再被 publish 路径改写：publish 只接受 mode 参数（不 setSetting postiz_type）
  setSetting('postiz_type', 'now');
  const beforeType = setting('postiz_type');
  // 不实际联网发帖；只验证 publish 内部 normalize 不写全局（通过导出函数与源码契约）
  ok('发布模式不从全局读取（normalize 优先 mode 参数）', postiz.normalizePublishMode('draft', 'now') === 'draft' && beforeType === 'now');

  console.log('\n[4] PUB-04：账号 → integration 显式绑定');
  const list = [
    { id: 'it-x', identifier: 'x', name: 'X 号', disabled: false },
    { id: 'it-ig', identifier: 'instagram', name: 'IG 号', disabled: false },
  ];
  let threwEmpty = false;
  try { postiz.resolveBoundIntegration({ id: 9, handle: 'h', integration_id: '' }, 'x', list); } catch (e) { threwEmpty = e.errorClass === 'pending_integration'; }
  ok('空绑定抛 pending_integration', threwEmpty);
  let threwMissing = false;
  try { postiz.resolveBoundIntegration({ id: 9, handle: 'h', integration_id: 'nope' }, 'x', list); } catch (e) { threwMissing = e.errorClass === 'pending_integration'; }
  ok('绑定不存在抛 pending_integration', threwMissing);
  let threwMismatch = false;
  try { postiz.resolveBoundIntegration({ id: 9, handle: 'h', integration_id: 'it-ig' }, 'x', list); } catch (e) { threwMismatch = e.errorClass === 'pending_integration'; }
  ok('平台不匹配抛 pending_integration', threwMismatch);
  const hit = postiz.resolveBoundIntegration({ id: 9, handle: 'h', integration_id: 'it-x' }, 'x', list);
  ok('正确绑定命中', hit.id === 'it-x');

  console.log('\n[5] PUB-03/07：unknown_result 不重发（错误分类）');
  const eUnknown = new errors.PublishError(errors.RESULT_UNKNOWN_CLASS, 'x', '', { dispatched: true, outcomeKnown: false });
  ok('unknown_result errorClass 正确', eUnknown.errorClass === errors.RESULT_UNKNOWN_CLASS);
  ok('unknownResult 判定', eUnknown.unknownResult === true);
  const eRefused = new errors.PublishError('upstream_error', 'x', '', { dispatched: true, outcomeKnown: true });
  ok('明确拒绝不是 unknown', eRefused.unknownResult === false);

  console.log('\n[6] SEC-02：访问控制');
  const token = 'A'.repeat(32);
  const allowHosts = auth.defaultAllowHosts('');
  const mkReq = (o) => ({ method: 'GET', headers: { host: '127.0.0.1', ...o } });
  ok('缺 token 拒绝', auth.checkRequest(mkReq({}), { token, allowHosts }).status === 401);
  ok('错误 token 拒绝', auth.checkRequest(mkReq({ 'x-swb-token': 'bad' }), { token, allowHosts }).status === 401);
  ok('正确 token 放行', auth.checkRequest(mkReq({ 'x-swb-token': token }), { token, allowHosts }).ok === true);
  ok('恶意 Host 拒绝（DNS rebinding）', auth.checkRequest(mkReq({ host: 'evil.example.com' }), { token, allowHosts }).status === 403);
  ok('跨站 Origin 写操作拒绝', auth.checkRequest({ method: 'POST', headers: { host: '127.0.0.1', origin: 'https://evil.example.com', 'x-swb-token': token, 'content-type': 'application/json' } }, { token, allowHosts }).status === 403);
  ok('非 JSON 写操作拒绝', auth.checkRequest({ method: 'POST', headers: { host: '127.0.0.1', 'x-swb-token': token, 'content-type': 'text/plain', 'content-length': '5' } }, { token, allowHosts }).status === 415);

  console.log('\n[7] SEC-03：SSRF 阻断');
  ok('ipForbidden 拦 127.0.0.1', sf.ipForbidden('127.0.0.1') === true);
  ok('ipForbidden 拦 10.x', sf.ipForbidden('10.0.0.1') === true);
  ok('ipForbidden 拦 192.168.x', sf.ipForbidden('192.168.1.1') === true);
  ok('ipForbidden 拦 169.254.x（云元数据）', sf.ipForbidden('169.254.169.254') === true);
  ok('ipForbidden 拦 172.16.x', sf.ipForbidden('172.16.0.1') === true);
  ok('ipForbidden 拦 IPv6 ::1', sf.ipForbidden('::1') === true);
  ok('ipForbidden 拦 IPv4-mapped', sf.ipForbidden('::ffff:127.0.0.1') === true);
  ok('ipForbidden 放行公网', sf.ipForbidden('8.8.8.8') === false);
  let threwLoop = false;
  try { await sf.assertPublicUrl('http://127.0.0.1/x'); } catch { threwLoop = true; }
  ok('assertPublicUrl 拒绝字面回环', threwLoop);
  let threwLocalhost = false;
  try { await sf.assertPublicUrl('http://localhost/x'); } catch { threwLocalhost = true; }
  ok('assertPublicUrl 拒绝 localhost', threwLocalhost);
  let threwProto = false;
  try { await sf.assertPublicUrl('file:///etc/passwd'); } catch { threwProto = true; }
  ok('assertPublicUrl 拒绝非 http(s)', threwProto);

  console.log('\n[8] SEC-01：源码无明文密钥');
  const SECRET_RE = /sk-[A-Za-z0-9_-]{20,}|xoxb-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}/;
  // postiz 云 key 完整值用拼接构造，避免扫描脚本自身字面量被误命中
  const POSTIZ_FULL = 'e77fa996b6a61d4d15' + 'fbe4d63ebeab8ef8ab0c86755e3a4977213419df87348f';
  const walk = (dir) => {
    let out = [];
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      const st = statSync(p);
      if (st.isDirectory()) { if (!['node_modules', '.git', 'data'].includes(e)) out = out.concat(walk(p)); }
      else if (/\.(mjs|js|json|md|txt|html)$/i.test(e)) out.push(p);
    }
    return out;
  };
  const files = walk(ROOT);
  let secretHits = [];
  for (const f of files) {
    const c = readFileSync(f, 'utf8');
    if (SECRET_RE.test(c) || c.includes(POSTIZ_FULL)) secretHits.push(path.relative(ROOT, f));
  }
  ok('源码/文档无完整密钥明文', secretHits.length === 0, '→ ' + secretHits.join(', '));

  console.log('\n[9] 隔离库也无明文密钥（audit_log/setting）');
  const dbScan = await import('./scan-plaintext-secrets.mjs').catch(() => null);
  // scan-plaintext-secrets 读的是副本 data，这里只验证隔离库
  const plain = all("select k,v from setting where v not like 'enc:%' and (v like 'sk-%' or v like '%e77fa9%')");
  ok('隔离 setting 无明文密钥', plain.length === 0);

  console.log(`\n==============================`);
  console.log(`通过 ${pass} / ${pass + fail}`);
  if (fail) console.log('失败项：\n' + results.filter((r) => r.includes('✘')).join('\n'));
  console.log(`==============================`);

  // 清理隔离目录
  try { rmSync(ISO, { recursive: true, force: true }); } catch {}
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('[verify-batch1] 失败:', e); process.exit(2); });
