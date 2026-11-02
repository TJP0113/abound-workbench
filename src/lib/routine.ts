import { addDays, parseDate, fmt } from "./dates";
import type { Repeat, Task } from "./types";

export function isRoutine(t: Pick<Task, "kind">): boolean {
  return t.kind === "routine";
}

/** 下一次的截止日：从上一次截止日往后推，直到不早于今天 */
export function nextDue(prev: string, repeat: Repeat, today: string): string | null {
  if (repeat === "none") return null;
  const step = (d: string): string => {
    if (repeat === "daily") return addDays(d, 1);
    if (repeat === "weekly") return addDays(d, 7);
    // 每月：同一天；遇到小月就用当月最后一天
    const x = parseDate(d);
    const day = parseDate(prev).getUTCDate();
    const y = x.getUTCFullYear();
    const m = x.getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return fmt(new Date(Date.UTC(y, m, Math.min(day, last))));
  };
  let d = step(prev);
  for (let i = 0; d < today && i < 1000; i++) d = step(d);
  return d;
}
