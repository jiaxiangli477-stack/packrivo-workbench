/* 发布门禁（PUB-01）。
   所有外发入口——建排期、入队、真正发送——都走同一个判定函数，避免「排期时拦住了、队列里漏掉」。
   判定只认库里的版本字段，不认请求体里的 status：前端传 status=approved 不构成批准。

   为什么用版本号而不是布尔：
   内容被改写（正文/标签/配图/图注）后，旧的「已批准」不再是这个人看过的稿子，
   拿布尔标记续用会静默把没审过的字发出去。content_version 每次实质修改 +1，
   approved_version 只由人工/AI 审核动作写入，两者相等才算当前版本已批准。 */

export const GATE_CODES = {
  content_missing: '内容不存在',
  content_rejected: '内容已被驳回，必须重新走审核',
  content_not_approved: '当前内容版本未获人工批准，不允许外发',
  content_draft: '内容是草稿状态，先走审核流程',
  schedule_stale: '排期对应的内容版本已变（批准失效），需要重新审核后重建排期',
  account_missing: '排期指向的账号不存在',
  account_inactive: '账号状态不是 active，先恢复再发',
  account_platform_mismatch: '账号平台与内容平台不一致',
  account_unbound: '账号未绑定 Postiz integration',
};

export function contentVersion(content) {
  return Number(content?.content_version || 0);
}

/** 内容本身是否可发（不含账号/排期）。 */
export function checkContentApproved(content) {
  if (!content) return fail('content_missing');
  const v = contentVersion(content);
  if (!v) return fail('content_not_approved', '内容缺少 content_version 字段，库未迁移');
  if (content.status === 'rejected') return fail('content_rejected');
  if (content.status === 'draft') return fail('content_draft');
  const approved = Number(content.approved_version || 0);
  if (!approved) return fail('content_not_approved', `内容 v${v} 从未被批准（approved_version=0）`);
  if (approved !== v) return fail('content_not_approved', `批准的是 v${approved}，当前是 v${v}，需要重新审核`);
  return { ok: true, content_version: v };
}

/** 完整判定：内容版本 + 账号 + 排期版本。
    requireIntegration 只在走 Postiz 通道时为 true（mock / webhook / mastodon 直连不需要 integration）。 */
export function checkPublishable({ content, account, schedule, requireIntegration = false } = {}) {
  // 排期版本漂移优先于内容批准状态：这条排期绑的是旧版本，无论如何都得先重建排期。
  // 内容被改后 approved_version 往往也落后（批准失效），若先判批准会返回 content_not_approved，
  // 把「重建排期」这个更直接的信号盖掉。
  if (schedule) {
    const sv = Number(schedule.content_version || 0);
    const cv = Number(content?.content_version || 0);
    if (sv !== cv) {
      return fail('schedule_stale', `排期绑定 v${sv}，内容已到 v${cv}（批准失效，需重新审核后重建排期）`);
    }
  }

  const c = checkContentApproved(content);
  if (!c.ok) return c;

  if (!account) return fail('account_missing');
  if (String(account.status || '') !== 'active') {
    return fail('account_inactive', `账号 #${account.id} 状态是 ${account.status}`);
  }
  if (String(account.platform || '') !== String(content.platform || '')) {
    return fail('account_platform_mismatch', `账号是 ${account.platform}，内容是 ${content.platform}`);
  }
  if (requireIntegration && !String(account.integration_id || '').trim()) {
    return fail('account_unbound', `账号 #${account.id} 没有 integration_id`);
  }

  return { ok: true, content_version: c.content_version };
}

function fail(code, detail = '') {
  return { ok: false, code, reason: detail ? `${GATE_CODES[code]}：${detail}` : GATE_CODES[code] };
}
