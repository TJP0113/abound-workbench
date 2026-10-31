import { serviceProgress } from "./services";
import { monthStr } from "./dates";
import type { Lang, Project, ProjectService, Task } from "./types";
import { translate } from "./i18n";

/** 社交媒体服务：当月周期的完成度（按当月任务） */
export function socialCycleProgress(p: Project, tasks: Task[]): { done: number; total: number } | null {
  const svc = p.services.find((s) => s.type === "social");
  if (!svc?.social) return null;
  const month = monthStr();
  const list = tasks.filter((t) => t.projectId === p.id && t.cycle === month);
  if (!list.length) return null;
  return { done: list.filter((t) => t.status === "done").length, total: list.length };
}

export function serviceProgressWithTasks(p: Project, s: ProjectService, tasks: Task[]): number {
  if (s.type === "social") {
    const c = socialCycleProgress(p, tasks);
    if (c) return Math.round((c.done / c.total) * 100);
  }
  return serviceProgress(s);
}

/** 项目完成百分比 = 各项服务的平均 */
export function projectProgress(p: Project, tasks: Task[]): number {
  if (p.status === "done") return 100;
  if (!p.services.length) return 0;
  const sum = p.services.reduce((a, s) => a + serviceProgressWithTasks(p, s, tasks), 0);
  return Math.round(sum / p.services.length);
}

/** 第一项未完成服务的当前阶段 */
export function currentStage(p: Project): { svc: ProjectService; stage: string | null; index: number } | null {
  const svc = p.services.find((s) => s.current < s.stages.length) ?? p.services[0];
  if (!svc) return null;
  return { svc, stage: svc.current < svc.stages.length ? svc.stages[svc.current] : null, index: svc.current };
}

export function taskTitle(t: Task, lang: Lang): string {
  if (t.autoTitle) return translate(lang, t.autoTitle.key, t.autoTitle.vars);
  return t.title;
}

export function isOpen(t: Task): boolean {
  return t.status !== "done";
}
