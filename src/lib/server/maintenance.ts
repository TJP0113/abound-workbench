import "server-only";
import { adminDb } from "./admin";
import { addDays, lastDayOfMonth, monthStr, todayStr } from "../dates";
import { translate } from "../i18n";
import type { AppNotification, NotificationType, Project, Task } from "../types";

/** 社交媒体营销：建立当月周期、合约结束后自动完成 */
export async function runSocialCycles(): Promise<{ cycles: number; finished: number }> {
  const db = adminDb();
  const month = monthStr();
  const snap = await db.collection("projects").get();
  let cycles = 0;
  let finished = 0;

  for (const d of snap.docs) {
    const p = d.data() as Project;
    if (p.status !== "active" && p.status !== "waiting") continue;
    const idx = p.services.findIndex((s) => s.type === "social" && s.social);
    if (idx < 0) continue;
    const svc = p.services[idx];
    const plan = svc.social!;

    if (plan.endMonth && month > plan.endMonth) {
      await d.ref.update({ status: "done", updatedAt: Date.now() });
      finished++;
      continue;
    }
    if (month < plan.startMonth) continue;
    if (plan.cycles?.some((c) => c.month === month)) continue;

    const services = [...p.services];
    services[idx] = {
      ...svc,
      current: 0,
      social: { ...plan, cycles: [...(plan.cycles || []), { month, posts: plan.posts, videos: plan.videos }] },
    };
    const batch = db.batch();
    batch.update(d.ref, { services, updatedAt: Date.now() });
    const due = lastDayOfMonth(month);
    const mk = (key: string, n: number): Omit<Task, "id"> => {
      const vars = { month, n };
      return {
        projectId: d.id,
        projectName: p.name,
        serviceType: "social",
        title: translate("zh", key, vars),
        autoTitle: { key, vars },
        assigneeEmails: [p.ownerEmail],
        memberEmails: p.memberEmails,
        due,
        priority: "medium",
        status: "todo",
        subtasks: [],
        cycle: month,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    };
    for (let i = 1; i <= plan.posts; i++) batch.set(db.collection("tasks").doc(), mk("social.post", i));
    for (let i = 1; i <= plan.videos; i++) batch.set(db.collection("tasks").doc(), mk("social.video", i));
    await batch.commit();
    cycles++;
  }
  return { cycles, finished };
}

async function sendNotifs(to: string[], type: NotificationType, title: string, link: string) {
  const db = adminDb();
  const batch = db.batch();
  for (const toEmail of Array.from(new Set(to))) {
    const n: Omit<AppNotification, "id"> = {
      toEmail,
      type,
      text: translate("zh", `notif.${type}`, { title }),
      textEn: translate("en", `notif.${type}`, { title }),
      link,
      read: false,
      createdAt: Date.now(),
    };
    batch.set(db.collection("notifications").doc(), n);
  }
  await batch.commit();
}

/** 每日提醒：明天截止、刚逾期；并清理 30 天前已读通知 */
export async function runReminders(): Promise<{ sent: number }> {
  const db = adminDb();
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const [tasks, projects, members] = await Promise.all([
    db.collection("tasks").get(),
    db.collection("projects").get(),
    db.collection("members").get(),
  ]);
  const admins = members.docs.filter((m) => m.data().role === "admin" && m.data().active).map((m) => m.id);
  let sent = 0;

  for (const d of tasks.docs) {
    const t = d.data() as Task;
    if (t.status === "done") continue;
    const link = `/tasks?task=${d.id}`;
    const title = `${t.title} · ${t.projectName}`;
    if (t.due === tomorrow) {
      await sendNotifs(t.assigneeEmails, "dueSoon", title, link);
      sent++;
    } else if (t.due === yesterday) {
      await sendNotifs([...t.assigneeEmails, ...admins], "overdue", title, link);
      sent++;
    }
  }
  for (const d of projects.docs) {
    const p = d.data() as Project;
    if (p.status === "done" || p.status === "cancelled") continue;
    if (p.dueDate === tomorrow) {
      await sendNotifs([p.ownerEmail, ...admins], "dueSoon", p.name, `/projects/${d.id}`);
      sent++;
    }
  }

  const cutoff = Date.now() - 30 * 86400000;
  const old = await db.collection("notifications").where("read", "==", true).get();
  const stale = old.docs.filter((n) => (n.data().createdAt as number) < cutoff);
  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    stale.slice(i, i + 400).forEach((n) => batch.delete(n.ref));
    await batch.commit();
  }
  return { sent };
}
