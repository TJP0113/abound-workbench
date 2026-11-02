import "server-only";

/** 网站正式网址。容错：没写 https:// 时自动补上，去掉结尾斜线 */
export function appUrl(): string {
  let u = (process.env.APP_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, "")}`;
  return u;
}
