// 发布链路的错误分类。单独成文件是为了让 postiz.mjs 与 channels.mjs 互不引用（避免循环依赖）。
// errorClass 决定 queue.mjs 的处理方式：
//   pending_config / pending_integration / pending_media → blocked（不重试，等人补配置）
//   rate_limited / upstream_error / exception            → retry（退避重试）
//   unknown_result                                      → 不重试，转人工核对（结果未知时绝不能重发）
//
// dispatched / outcomeKnown 是 PUB-06 的关键：只按 errorClass 猜「有没有发出去」会在网络中断时撒谎。
//   dispatched=false  → 请求根本没写到 socket，重发安全
//   dispatched=true & outcomeKnown=true  → 远端明确拒绝（4xx/5xx 带响应体），重发安全
//   dispatched=true & outcomeKnown=false → 远端可能已经建了帖，重发会重复发布
export class PublishError extends Error {
  constructor(errorClass, message, detail = '', { dispatched = false, outcomeKnown = true } = {}) {
    super(message);
    this.name = 'PublishError';
    this.errorClass = errorClass;
    this.detail = detail;
    this.dispatched = !!dispatched;
    this.outcomeKnown = !!outcomeKnown;
  }

  get unknownResult() {
    return this.dispatched && !this.outcomeKnown;
  }
}

export const RESULT_UNKNOWN_CLASS = 'unknown_result';
