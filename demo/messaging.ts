// 本地预览：不支持推送
export async function isSupported() {
  return false;
}
export function getMessaging() {
  return {};
}
export async function getToken() {
  return "demo";
}
export async function deleteToken() {
  return true;
}
