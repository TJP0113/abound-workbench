import type { CalEvent, EventType, Lang, Project, Task } from "./types";
import { translate } from "./i18n";
import { taskTitle } from "./project-utils";

export interface CalItem {
  key: string;
  date: string;
  endDate?: string;
  title: string;
  type: EventType;
  time?: string;
  link?: string; // 来自项目或任务时，点开跳转
  event?: CalEvent; // 可直接编辑的活动
  people: string[];
}

/** 把项目交货日、外包日期、任务截止日与活动合成日历项目 */
export function buildCalendarItems(projects: Project[], tasks: Task[], events: CalEvent[], lang: Lang): CalItem[] {
  const t = (k: string, v?: Record<string, string>) => translate(lang, k, v);
  const out: CalItem[] = [];
  for (const p of projects) {
    if (p.status === "cancelled" || p.status === "done") continue;
    if (p.dueDate)
      out.push({
        key: `p_${p.id}`,
        date: p.dueDate,
        title: `${t("evt.deliveryShort")} · ${p.name}`,
        type: "delivery",
        link: `/projects/${p.id}`,
        people: p.memberEmails,
      });
    const o = p.outsourcing;
    if (o?.vendorEta)
      out.push({
        key: `pv_${p.id}`,
        date: o.vendorEta,
        title: `${t("out.vendorEtaEvent", { name: o.vendorName || t("out.vendor") })} · ${p.name}`,
        type: "deadline",
        link: `/projects/${p.id}`,
        people: p.memberEmails,
      });
    if (o?.printerEta)
      out.push({
        key: `pp_${p.id}`,
        date: o.printerEta,
        title: `${t("out.printerEtaEvent", { name: o.printerName || t("out.printer") })} · ${p.name}`,
        type: "deadline",
        link: `/projects/${p.id}`,
        people: p.memberEmails,
      });
  }
  for (const x of tasks) {
    if (x.status === "done" || !x.due) continue;
    out.push({
      key: `t_${x.id}`,
      date: x.due,
      title: `${t("evt.deadlineShort")} · ${taskTitle(x, lang)}`,
      type: "deadline",
      link: `/tasks?task=${x.id}`,
      people: x.assigneeEmails,
    });
  }
  for (const e of events) {
    out.push({
      key: `e_${e.id}`,
      date: e.date,
      endDate: e.endDate,
      title: e.title,
      type: e.type,
      time: e.allDay ? undefined : e.startTime,
      event: e,
      people: e.attendeeEmails ?? [],
    });
  }
  const order: Record<EventType, number> = { delivery: 0, meeting: 1, internal: 2, deadline: 3 };
  return out.sort((a, b) => a.date.localeCompare(b.date) || order[a.type] - order[b.type] || (a.time || "").localeCompare(b.time || ""));
}

export function itemsOnDay(items: CalItem[], day: string): CalItem[] {
  return items.filter((i) => (i.endDate && i.endDate > i.date ? day >= i.date && day <= i.endDate : i.date === day));
}
