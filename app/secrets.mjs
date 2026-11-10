// 密钥类设置项的唯一清单：写入时 AES-GCM 加密落库，读出时解密，接口一律不回明文。
// 新增一个密钥只要加进这里，db 层与 /api/settings 都会自动按密钥对待。
export const SECRET_KEYS = new Set([
  'postiz_api_key',
  'image_api_key',
  'image_api_backup_key',
  'image_api_fallback_key',
  'apify_token',
  'telegram_bot_token',
]);

export const isSecretKey = (k) => SECRET_KEYS.has(String(k));

// 审计日志里留痕用：只保留后 4 位
export function maskSecret(s) {
  const v = String(s ?? '');
  if (!v) return '';
  return v.length <= 4 ? '****' : '****' + v.slice(-4);
}
