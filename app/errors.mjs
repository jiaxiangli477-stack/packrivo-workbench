// 发布链路的错误分类。单独成文件是为了让 postiz.mjs 与 channels.mjs 互不引用（避免循环依赖）。
// errorClass 决定 queue.mjs 的处理方式：
//   pending_config / pending_integration / pending_media → blocked（不重试，等人补配置）
//   rate_limited / upstream_error / exception            → retry（退避重试，3 次后 failed）
export class PublishError extends Error {
  constructor(errorClass, message, detail = '') {
    super(message);
    this.name = 'PublishError';
    this.errorClass = errorClass;
    this.detail = detail;
  }
}
