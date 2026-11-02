"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskActions } from "@/components/TaskBits";
import { PushBanner } from "@/components/PushCard";
import { Avatar, Card, DueLabel, EmptyState, Pill, PRIORITY_COLORS, ProgressBar, Segmented, ServiceTag } from "@/components/ui";
import { EVENT_COLORS, SERVICE_COLORS } from "@/lib/services";
import { currentStage, projectProgress, taskTitle } from "@/lib/project-utils";
import { buildCalendarItems } from "@/lib/calendar-items";
import { addDays, daysBetween, dueTone, formatDate, todayStr, weekStart, weekdayShort } from "@/lib/dates";
import type { Task } from "@/lib/types";

const LEAD_DAYS = 7;

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="m-0 text-[15px] font-bold">{children}</h3>
      {aside}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang, member, isAdmin, stage } = useAuth();
  const { tasks, projects, events, members } = useData();
  const [range, setRange] = useState<"today" | "week">("today");
  const [open, setOpen] = useState<Task | null>(null);
  const today = todayStr();
  const weekEnd = addDays(weekStart(today), 6);
  const me = member!.email;

  const mine = tasks.filter((x) => x.assigneeEmails.includes(me) && x.status !== "done");
  // 任务在截止日前 LEAD_DAYS 天就出现在「今天要做」
  const myToday = mine.filter((x) => x.due <= addDays(today, LEAD_DAYS) && x.status !== "review");
  const myWeek = mine.filter((x) => x.status !== "review");
  const shown = (range === "today" ? myToday : myWeek).sort((a, b) => a.due.localeCompare(b.due));
  const revisions = mine.filter((x) => x.status === "revise");

  const upcoming = useMemo(() => {
    const all = buildCalendarItems(projects, tasks, events, lang).filter((i) => i.date >= today && i.date <= addDays(today, 14));
    const rel = isAdmin ? all : all.filter((i) => i.people.includes(me));
    return rel.filter((i) => i.type !== "deadline" || i.people.includes(me)).slice(0, 6);
  }, [projects, tasks, events, lang, today, isAdmin, me]);

  // ---- 管理员团队总览 ----
  const open_ = projects.filter((p) => p.status === "active" || p.status === "waiting");
  const dueWeek = open_.filter((p) => p.dueDate >= today && p.dueDate <= weekEnd);
  const overdueTasks = tasks.filter((x) => x.status !== "done" && x.due < today);
  const toReview = tasks.filter((x) => x.status === "review");
  const alerts = [
    ...open_.filter((p) => dueTone(p.dueDate, today) !== "none").map((p) => ({ key: p.id, date: p.dueDate, title: p.name, meta: p.client, link: `/projects/${p.id}` })),
    ...overdueTasks.map((x) => ({ key: x.id, date: x.due, title: taskTitle(x, lang), meta: x.projectName, link: `/tasks?task=${x.id}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const load = members
    .filter((m) => m.active)
    .map((m) => ({ m, n: tasks.filter((x) => x.status !== "done" && x.due <= weekEnd && x.assigneeEmails.includes(m.email)).length }));
  const maxLoad = Math.max(8, ...load.map((l) => l.n));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[26px] sm:text-[28px] font-bold tracking-tight">{t("dash.hello", { name: member!.name })}</h1>
          <p className="m-0 text-[14px] text-muted">
            {formatDate(today, lang)} {weekdayShort(today, lang)} · {isAdmin ? t("dash.adminView") : t("dash.staffView")}
          </p>
        </div>
        <TopBar />
      </header>

      <PushBanner />

      <section aria-labelledby="mine" className="flex flex-col gap-3.5">
        <h2 id="mine" className="m-0 text-[16px] font-bold">
          {t("dash.mine")}
        </h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <Card className="flex flex-col gap-3.5">
            <SectionTitle
              aside={
                <Segmented
                  label={t("dash.myTasks")}
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "today", label: `${t("dash.today")} ${myToday.length}` },
                    { value: "week", label: `${t("dash.week")} ${myWeek.length}` },
                  ]}
                />
              }
            >
              {t("dash.myTasks")}
            </SectionTitle>
            {range === "today" && <p className="m-0 -mt-1.5 text-[12px] text-faint">{t("dash.leadHint", { n: LEAD_DAYS })}</p>}
            <div className="flex flex-col">
              {shown.length === 0 && <EmptyState>{t("dash.noTasks")}</EmptyState>}
              {shown.slice(0, 8).map((x) => (
                <div key={x.id} className="flex gap-3 py-3 border-t border-line-soft">
                  <span aria-hidden="true" className="w-1 self-stretch rounded-sm flex-none" style={{ background: PRIORITY_COLORS[x.priority] }} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <button type="button" onClick={() => setOpen(x)} className="text-left text-[14px] font-medium cursor-pointer">
                      {taskTitle(x, lang)}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                      {x.serviceType && <ServiceTag type={x.serviceType} />}
                      <span>{x.projectName}</span>
                    </div>
                    <TaskActions task={x} />
                  </div>
                  <DueLabel date={x.due} className="text-[12px]" />
                </div>
              ))}
            </div>
            <Link href="/tasks" className="text-[13px] font-medium no-underline">
              {t("common.viewAll")} →
            </Link>
          </Card>

          <Card className="flex flex-col gap-3.5">
            <SectionTitle aside={revisions.length > 0 && <Pill bg="#FCE8E8" fg="#A82828">{t("dash.revisionsCount", { n: revisions.length })}</Pill>}>
              {t("dash.revisions")}
            </SectionTitle>
            <div className="flex flex-col gap-2.5">
              {revisions.length === 0 && <EmptyState>{t("common.none")}</EmptyState>}
              {revisions.map((x) => (
                <div key={x.id} className="flex flex-col gap-2 p-3.5 rounded-[10px] bg-well border border-line-soft">
                  <div className="flex justify-between gap-2">
                    <button type="button" onClick={() => setOpen(x)} className="text-left text-[14px] font-medium cursor-pointer">
                      {taskTitle(x, lang)}
                    </button>
                    <DueLabel date={x.due} className="text-[12px]" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    {x.serviceType && <ServiceTag type={x.serviceType} />}
                    <span>{x.projectName}</span>
                  </div>
                  {x.reviewNote && (
                    <div className="text-[13px] text-ink-2 leading-relaxed">
                      <span className="text-muted">{t("dash.revisionNote")}</span>
                      {x.reviewNote}
                    </div>
                  )}
                  <TaskActions task={x} />
                </div>
              ))}
            </div>
            <p className="m-0 text-[12px] text-faint">{t("dash.whatsapp")}</p>
          </Card>

          <Card className="flex flex-col gap-3.5">
            <SectionTitle>{t("dash.events")}</SectionTitle>
            <div className="flex flex-col">
              {upcoming.length === 0 && <EmptyState>{t("common.none")}</EmptyState>}
              {upcoming.map((e) => (
                <Link key={e.key} href={e.link ?? "/calendar"} className="flex gap-3.5 py-3 border-t border-line-soft items-center no-underline text-ink">
                  <div className="w-12 flex-none text-center flex flex-col gap-0.5">
                    <span className="text-[11px] text-muted">{weekdayShort(e.date, lang)}</span>
                    <span className="text-[20px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {Number(e.date.slice(8))}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-[14px] font-medium truncate">{e.title}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: EVENT_COLORS[e.type].solid }} />
                      {t(`evt.${e.type}`)}
                      {e.time ? ` · ${e.time}` : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/calendar" className="text-[13px] font-medium no-underline">
              {t("dash.openCalendar")} →
            </Link>
          </Card>
        </div>
      </section>

      {isAdmin && (
        <section aria-labelledby="team" className="flex flex-col gap-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 id="team" className="m-0 text-[16px] font-bold">
              {t("dash.team")}
            </h2>
            <span className="text-[12px] text-faint">{t("dash.adminOnly")}</span>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {[
              { label: t("dash.activeProjects"), value: open_.length, sub: "", color: "#18191B", href: "/projects" },
              { label: t("dash.dueThisWeek"), value: dueWeek.length, sub: t("dash.dueThisWeekSub"), color: "#8A5A00", href: "/projects" },
              { label: t("dash.overdueTasks"), value: overdueTasks.length, sub: t("dash.overdueSub"), color: "#A82828", href: "/tasks" },
              { label: t("dash.toReview"), value: toReview.length, sub: t("dash.toReviewSub"), color: "#2D45C8", href: "/tasks" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="no-underline text-ink bg-card border border-line rounded-[14px] px-5 py-[18px] flex flex-col gap-2 hover:border-[#CFCFC9]">
                <span className="text-[13px] text-muted">{s.label}</span>
                <span className="text-[34px] font-semibold leading-none" style={{ fontFamily: "var(--font-display)", color: s.color }}>
                  {s.value}
                </span>
                <span className="text-[12px] text-faint min-h-4">{s.sub}</span>
              </Link>
            ))}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            <Card className="flex flex-col gap-4">
              <SectionTitle>{t("dash.progress")}</SectionTitle>
              {open_.length === 0 && <EmptyState>{t("proj.empty")}</EmptyState>}
              {[...open_]
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 8)
                .map((p) => {
                  const pct = projectProgress(p, tasks);
                  const cur = currentStage(p);
                  const type = p.services[0]?.type ?? "brand";
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} className="no-underline text-ink flex flex-col gap-2">
                      <div className="flex justify-between gap-3 text-[13px]">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                          {pct}%
                        </span>
                      </div>
                      <ProgressBar pct={pct} color={SERVICE_COLORS[type][1]} />
                      <div className="flex flex-wrap gap-2 text-[12px] text-muted items-center">
                        <ServiceTag type={type} variant={p.services[0]?.variant} label={p.services[0]?.label} />
                        {cur?.stage && <span>{t("dash.current", { stage: stage(cur.stage) })}</span>}
                        <span>{t("dash.due", { date: formatDate(p.dueDate, lang) })}</span>
                      </div>
                    </Link>
                  );
                })}
            </Card>

            <Card className="flex flex-col gap-3.5">
              <SectionTitle>{t("dash.alerts")}</SectionTitle>
              {alerts.length === 0 && <EmptyState>{t("dash.noAlerts")}</EmptyState>}
              {alerts.slice(0, 8).map((a) => {
                const left = daysBetween(today, a.date);
                const red = left <= 1;
                return (
                  <Link key={a.key} href={a.link} className="no-underline text-ink flex items-center gap-3 px-3.5 py-3 rounded-[10px] bg-well border border-line-soft">
                    <span
                      className="flex-none min-w-[64px] h-6 px-2 box-border rounded-md text-[12px] font-bold inline-flex items-center justify-center"
                      style={{ background: red ? "#FCE8E8" : "#FBF1DC", color: red ? "#A82828" : "#8A5A00" }}
                    >
                      {left < 0 ? t("common.overdueDays", { n: -left }) : left === 0 ? t("common.today") : left === 1 ? t("common.tomorrow") : t("common.daysLeft", { n: left })}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[14px] font-medium truncate">{a.title}</span>
                      <span className="text-[12px] text-muted truncate">{a.meta}</span>
                    </div>
                  </Link>
                );
              })}
              <p className="m-0 text-[12px] text-faint">{t("dash.alertsRule")}</p>
            </Card>

            <Card className="flex flex-col gap-4">
              <SectionTitle aside={<span className="text-[12px] text-faint">{t("dash.workloadSub")}</span>}>{t("dash.workload")}</SectionTitle>
              {load.map(({ m, n }) => (
                <div key={m.email} className="flex items-center gap-3">
                  <Avatar name={m.name} email={m.email} size={32} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="truncate">{m.name}</span>
                      <span className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        {t("common.items", { n })}
                      </span>
                    </div>
                    <ProgressBar pct={(n / maxLoad) * 100} color={n >= 7 ? "#C98A12" : "#18191B"} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </section>
      )}

      {open && <TaskForm open task={open} onClose={() => setOpen(null)} />}
    </>
  );
}
