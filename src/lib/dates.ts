import type { Lang } from "./types";

export const TIMEZONE = "Asia/Kuala_Lumpur";

/** 当前日期（马来西亚时间），格式 YYYY-MM-DD */
export function todayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthStr(now: Date = new Date()): string {
  return todayStr(now).slice(0, 7);
}

/** 把 YYYY-MM-DD 当作日历日期处理（UTC 午夜），避免时区偏移 */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** b - a 的天数 */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

/** 周一为一周第一天 */
export function weekStart(s: string): string {
  const d = parseDate(s);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(s, -dow);
}

export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

export type DueTone = "red" | "amber" | "none";

/** 交货前 3 天标黄，前 1 天及逾期标红 */
export function dueTone(due: string | undefined, today: string = todayStr()): DueTone {
  if (!due) return "none";
  const left = daysBetween(today, due);
  if (left <= 1) return "red";
  if (left <= 3) return "amber";
  return "none";
}

export function formatDate(s: string | undefined, lang: Lang): string {
  if (!s) return "—";
  const d = parseDate(s);
  if (lang === "zh") return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatMonth(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  if (lang === "zh") return `${y}年${m}月`;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function weekdayShort(s: string, lang: Lang): string {
  const dow = (parseDate(s).getUTCDay() + 6) % 7;
  const zh = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const en = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (lang === "zh" ? zh : en)[dow];
}

export function formatDateTime(ms: number | undefined, lang: Lang): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(lang === "zh" ? "zh-CN" : "en-GB", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
