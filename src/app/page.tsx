"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskActions, TaskKindTag } from "@/components/TaskBits";
import { PushBanner } from "@/components/PushCard";
import { ProjectForm } from "@/components/ProjectForm";
import { Avatar, Button, Card, DueLabel, EmptyState, Icon, Pill, ProgressBar, Segmented, ServiceTag, StatusDot, TASK_STATUS_COLORS } from "@/components/ui";
import { EVENT_COLORS } from "@/lib/services";
import { currentStage, projectProgress, taskTitle } from "@/lib/project-utils";
import { buildCalendarItems } from "@/lib/calendar-items";
import { addDays, daysBetween, dueTone, formatDate, todayStr, weekStart, weekdayShort } from "@/lib/dates";
import type { Task } from "@/lib/types";

const LEAD_DAYS = 7;

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="m-0 text-[15px] font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang, member, isAdmin, stage } = useAuth();
  const { tasks, projects, events, members } = useData();
  const [range, setRange] = useState<"today" | "week">("today");
  const [open, setOpen] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
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

  const taskStatusLabel = (st: Task["status"]) => t(st === "done" ? "status.taskDone" : `status.${st}`);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] font-bold tracking-tight">{t("dash.hello", { name: member!.name })}</h1>
          <p className="m-0 text-[13px] text-muted">
            {formatDate(today, lang)} {weekdayShort(today, lang)} · {isAdmin ? t("dash.adminView") : t("dash.staffView")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <TopBar />
          {isAdmin && (
            <Button variant="primary" onClick={() => setCreatingProject(true)}>
              <Icon name="plus" size={16} />
              {t("proj.new")}
            </Button>
          )}
        </div>
      </header>

      <PushBanner />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[300px_minmax(0,1fr)_300px] items-start">
        {/* 第一栏 */}
        <div className="flex flex-col gap-4 min-w-0">
          <section className="rounded-[24px] bg-brand shadow-brand p-1.5 flex flex-col">
            <div className="flex justify-between items-start gap-3 px-3 pt-3 pb-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 text-[15px] font-semibold text-white">{t("dash.todayWork")}</h2>
                <span className="text-[12px] text-[#FFE3DF]">{t("dash.leadHint", { n: LEAD_DAYS })}</span>
              </div>
            </div>
            <div className="bg-white rounded-[19px] px-4 pt-4 pb-1 flex flex-col gap-1">
              <span className="text-[12px] text-ink-2">{t("dash.today")}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[40px] font-semibold tracking-tight leading-none">{myToday.length}</span>
                <span className="text-[26px] font-medium text-[#B5AFA7] leading-none">/ {mine.length}</span>
                <span className="text-[12px] text-muted ml-1">{t("dash.ofTasks")}</span>
              </div>
              {isAdmin && (
                <div className="flex gap-4 text-[12px] text-muted mt-2">
                  <Link href="/tasks" className="no-underline text-muted hover:text-ink">
                    {t("dash.overdueTasks")} <b className={overdueTasks.length ? "text-danger" : "text-ink"}>{overdueTasks.length}</b>
                  </Link>
                  <Link href="/tasks" className="no-underline text-muted hover:text-ink">
                    {t("dash.toReview")} <b className="text-ink">{toReview.length}</b>
                  </Link>
                </div>
              )}
              <div className="grid grid-cols-2 border-t border-line-soft mt-3">
                <button type="button" onClick={() => setCreatingTask(true)} className="h-12 text-[13px] font-medium flex items-center justify-center gap-1.5 border-r border-line-soft cursor-pointer">
                  <Icon name="check" size={16} />
                  {t("task.new")}
                </button>
                <Link href="/calendar" className="h-12 text-[13px] font-medium flex items-center justify-center gap-1.5 no-underline">
                  <Icon name="calendar" size={16} />
                  {t("dash.openCalendar")}
                </Link>
              </div>
            </div>
          </section>

          {isAdmin && (
            <Card className="flex flex-col gap-4">
              <SectionTitle aside={<span className="text-[12px] text-muted">{t("dash.workloadSub")}</span>}>{t("dash.workload")}</SectionTitle>
              {load.map(({ m, n }) => (
                <div key={m.email} className="flex items-center gap-3">
                  <Avatar name={m.name} email={m.email} size={38} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="truncate">{m.name}</span>
                      <span className="font-bold">{t("common.items", { n })}</span>
                    </div>
                    <ProgressBar pct={(n / maxLoad) * 100} />
                  </div>
                </div>
              ))}
            </Card>
          )}

          {revisions.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionTitle aside={<Pill bg="#FCE8E6" fg="#B3261E" round>{t("dash.revisionsCount", { n: revisions.length })}</Pill>}>
                {t("dash.revisions")}
              </SectionTitle>
              {revisions.map((x) => (
                <div key={x.id} className="flex flex-col gap-2 p-3.5 rounded-[16px] bg-well">
                  <div className="flex justify-between gap-2">
                    <button type="button" onClick={() => setOpen(x)} className="text-left text-[14px] font-medium cursor-pointer">
                      {taskTitle(x, lang)}
                    </button>
                    <DueLabel date={x.due} className="text-[12px]" />
                  </div>
                  {x.projectName && <span className="text-[12px] text-muted">{x.projectName}</span>}
                  {x.reviewNote && (
                    <div className="text-[13px] text-ink-2 leading-relaxed">
                      <span className="text-muted">{t("dash.revisionNote")}</span>
                      {x.reviewNote}
                    </div>
                  )}
                  <div className="w-fit min-w-[160px]">
                    <TaskActions task={x} />
                  </div>
                </div>
              ))}
              <p className="m-0 text-[12px] text-muted">{t("dash.whatsapp")}</p>
            </Card>
          )}
        </div>

        {/* 第二栏：优先处理 */}
        <Card className="!p-0 flex flex-col overflow-hidden min-w-0 lg:row-span-2 xl:row-span-1">
          <div className="flex flex-wrap justify-between items-start gap-3 px-5 pt-5 pb-3.5">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 text-[15px] font-semibold">{t("dash.myTasks")}</h2>
              <span className="text-[12px] text-muted">{range === "today" ? t("dash.leadHint", { n: LEAD_DAYS }) : t("dash.allOpen")}</span>
            </div>
            <Segmented
              label={t("dash.myTasks")}
              value={range}
              onChange={setRange}
              options={[
                { value: "today", label: `${t("dash.today")} ${myToday.length}` },
                { value: "week", label: `${t("dash.week")} ${myWeek.length}` },
              ]}
            />
          </div>
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_96px] gap-3 px-5 py-2 border-y border-line-soft text-[11.5px] text-muted">
            <span>{t("task.title")}</span>
            <span>{t("task.due")}</span>
            <span>{t("proj.status")}</span>
          </div>
          {shown.length === 0 && <EmptyState>{t("dash.noTasks")}</EmptyState>}
          {shown.slice(0, 12).map((x) => (
            <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_110px_96px] gap-x-3 gap-y-1.5 items-center px-5 py-3 border-b border-[#F5F3F0]">
              <div className="min-w-0 flex flex-col gap-1">
                <button type="button" onClick={() => setOpen(x)} className="text-left text-[13.5px] font-medium cursor-pointer truncate">
                  {taskTitle(x, lang)}
                </button>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                  <TaskKindTag task={x} />
                  {x.projectName && <span className="truncate">{x.projectName}</span>}
                </div>
              </div>
              <DueLabel date={x.due} className="text-[12px]" />
              <span className="hidden sm:block">
                <StatusDot dot={TASK_STATUS_COLORS[x.status][2]}>{taskStatusLabel(x.status)}</StatusDot>
              </span>
              <div className="col-span-full w-fit min-w-[160px] empty:hidden">
                <TaskActions task={x} />
              </div>
            </div>
          ))}
          <div className="p-3 flex justify-center mt-auto">
            <Link href="/tasks" className="h-9 px-5 rounded-full border border-line text-[12.5px] font-semibold no-underline flex items-center">
              {t("common.viewAll")}
            </Link>
          </div>
        </Card>

        {/* 第三栏 */}
        <div className="flex flex-col gap-4 min-w-0">
          {isAdmin && (
            <Card className="flex flex-col gap-4">
              <SectionTitle aside={<Link href="/projects" className="text-[12px] font-semibold text-muted no-underline">{t("common.viewAll")}</Link>}>
                {t("dash.progress")}
              </SectionTitle>
              {open_.length === 0 && <EmptyState>{t("proj.empty")}</EmptyState>}
              {[...open_]
                .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"))
                .slice(0, 6)
                .map((p) => {
                  const pct = projectProgress(p, tasks);
                  const cur = currentStage(p);
                  const type = p.services[0]?.type ?? "brand";
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} className="no-underline text-ink flex flex-col gap-2">
                      <div className="flex justify-between gap-3 text-[13px]">
                        <span className="font-semibold truncate">{p.name}</span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} />
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11.5px] text-muted items-center">
                        <ServiceTag type={type} variant={p.services[0]?.variant} label={p.services[0]?.label} />
                        {cur?.stage && <span>{t("dash.current", { stage: stage(cur.stage) })}</span>}
                        {p.dueDate && <span>{t("dash.due", { date: formatDate(p.dueDate, lang) })}</span>}
                      </div>
                    </Link>
                  );
                })}
            </Card>
          )}

          {isAdmin && alerts.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>{t("dash.alerts")}</SectionTitle>
              {alerts.slice(0, 6).map((a) => {
                const left = daysBetween(today, a.date);
                const red = left <= 1;
                return (
                  <Link key={a.key} href={a.link} className="no-underline text-ink flex items-center gap-3 p-2.5 rounded-[16px] border border-line-soft hover:bg-well">
                    <span
                      className="flex-none min-w-[60px] h-6 px-2 box-border rounded-full text-[11.5px] font-bold inline-flex items-center justify-center"
                      style={{ background: red ? "#FCE8E6" : "#FBF1DC", color: red ? "#B3261E" : "#8A5A00" }}
                    >
                      {left < 0 ? t("common.overdueDays", { n: -left }) : left === 0 ? t("common.today") : left === 1 ? t("common.tomorrow") : t("common.daysLeft", { n: left })}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium truncate">{a.title}</span>
                      <span className="text-[11.5px] text-muted truncate">{a.meta}</span>
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <SectionTitle>{t("dash.events")}</SectionTitle>
            {upcoming.length === 0 && <EmptyState>{t("common.none")}</EmptyState>}
            {upcoming.map((e) => (
              <Link key={e.key} href={e.link ?? "/calendar"} className="flex gap-3 p-2.5 rounded-[16px] border border-line-soft items-center no-underline text-ink hover:bg-well">
                <div className="w-11 h-12 rounded-[12px] bg-paper flex-none flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted">{weekdayShort(e.date, lang)}</span>
                  <span className="text-[17px] font-semibold leading-tight">{Number(e.date.slice(8))}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-[13px] font-medium truncate">{e.title}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_COLORS[e.type].solid }} />
                    {t(`evt.${e.type}`)}
                    {e.time ? ` · ${e.time}` : ""}
                  </span>
                </div>
              </Link>
            ))}
            <Link href="/calendar" className="h-11 mt-1 rounded-full bg-[#2A2724] text-white text-[13px] font-semibold no-underline flex items-center justify-center hover:bg-black hover:text-white">
              {t("dash.openCalendar")}
            </Link>
          </Card>
        </div>
      </div>

      {open && <TaskForm open task={open} onClose={() => setOpen(null)} />}
      {creatingTask && <TaskForm open onClose={() => setCreatingTask(false)} />}
      {creatingProject && <ProjectForm open onClose={() => setCreatingProject(false)} />}
    </>
  );
}
