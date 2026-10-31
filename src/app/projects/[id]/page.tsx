"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { ProjectForm } from "@/components/ProjectForm";
import { TaskForm } from "@/components/TaskForm";
import { OutsourcingPanel } from "@/components/OutsourcingPanel";
import { TaskActions } from "@/components/TaskBits";
import { Button, Card, DueLabel, EmptyState, Icon, PROJECT_STATUS_COLORS, Pill, ServiceTag, TASK_STATUS_COLORS, cx } from "@/components/ui";
import { useActions } from "@/lib/actions";
import { EVENT_COLORS } from "@/lib/services";
import { projectProgress, serviceProgressWithTasks, socialCycleProgress, taskTitle } from "@/lib/project-utils";
import { formatDate, formatMonth, monthStr } from "@/lib/dates";
import type { Project, ProjectService, Task } from "@/lib/types";

function StageTrack({ project, svc, index }: { project: Project; svc: ProjectService; index: number }) {
  const { t, stage, member, isAdmin } = useAuth();
  const { tasks } = useData();
  const { updateProject } = useActions();
  const canEdit = isAdmin || (!!member && project.memberEmails.includes(member.email));
  const pct = serviceProgressWithTasks(project, svc, tasks);

  const setCurrent = (n: number) => {
    const services = project.services.map((s, i) => (i === index ? { ...s, current: Math.max(0, Math.min(n, s.stages.length)) } : s));
    updateProject(project.id, { services }, project).catch(() => alert(t("err.permission")));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ServiceTag type={svc.type} variant={svc.variant} />
          <span className="text-[12px] text-muted">
            {svc.current >= svc.stages.length ? t("proj.allDone") : t("proj.stageOf", { a: svc.current + 1, b: svc.stages.length })} · {pct}%
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={svc.current <= 0} onClick={() => setCurrent(svc.current - 1)}>
              {t("proj.backStage")}
            </Button>
            <Button size="sm" variant="dark" disabled={svc.current >= svc.stages.length} onClick={() => setCurrent(svc.current + 1)}>
              {t("proj.completeStage")}
            </Button>
          </div>
        )}
      </div>
      <ol className="list-none m-0 p-0 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        {svc.stages.map((s, i) => {
          const done = i < svc.current;
          const now = i === svc.current;
          return (
            <li
              key={`${s}-${i}`}
              className={cx(
                "flex flex-col gap-2 p-3 rounded-[10px] min-h-[76px] box-border border",
                now ? "bg-accent-soft border-[#B9C3F2]" : "bg-well border-line-soft"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-semibold border"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: now ? "#2D45C8" : done ? "#18191B" : "#fff",
                    color: now || done ? "#fff" : "#5F6166",
                    borderColor: now ? "#2D45C8" : done ? "#18191B" : "#CFCFC9",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="text-[11px] text-muted">
                  {t(done ? "proj.stageState.done" : now ? "proj.stageState.now" : "proj.stageState.todo")}
                </span>
              </div>
              <span className="text-[13px] font-medium leading-snug">{stage(s)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SocialPanel({ project }: { project: Project }) {
  const { t, lang } = useAuth();
  const { tasks } = useData();
  const svc = project.services.find((s) => s.type === "social");
  if (!svc?.social) return null;
  const plan = svc.social;
  const cur = socialCycleProgress(project, tasks);
  const month = monthStr();
  const past = (plan.cycles || []).filter((c) => c.month !== month).sort((a, b) => b.month.localeCompare(a.month));
  return (
    <Card className="flex flex-col gap-3 !p-[22px]">
      <h2 className="m-0 text-[15px] font-bold">{t("social.title")}</h2>
      <dl className="m-0 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
        <dt className="text-muted">{t("social.start")}</dt>
        <dd className="m-0">{formatMonth(plan.startMonth, lang)}</dd>
        <dt className="text-muted">{t("social.end")}</dt>
        <dd className="m-0">{plan.endMonth ? formatMonth(plan.endMonth, lang) : t("social.ongoing")}</dd>
        <dt className="text-muted">{t("social.posts")}</dt>
        <dd className="m-0">{plan.posts}</dd>
        <dt className="text-muted">{t("social.videos")}</dt>
        <dd className="m-0">{plan.videos}</dd>
      </dl>
      <div className="flex flex-col gap-1.5 pt-3 border-t border-line-soft">
        <span className="text-[13px] font-bold">
          {t("social.cycle")} · {formatMonth(month, lang)}
        </span>
        {cur ? (
          <span className="text-[13px]">{t("social.cycleProgress", { a: cur.done, b: cur.total })}</span>
        ) : (
          <span className="text-[12px] text-faint">{t("social.noCycle")}</span>
        )}
      </div>
      {past.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-3 border-t border-line-soft">
          <span className="text-[13px] font-bold">{t("social.history")}</span>
          {past.map((c) => {
            const list = tasks.filter((x) => x.projectId === project.id && x.cycle === c.month);
            const done = list.filter((x) => x.status === "done").length;
            return (
              <div key={c.month} className="flex justify-between text-[13px]">
                <span>{formatMonth(c.month, lang)}</span>
                <span className="text-muted">
                  {done} / {list.length || c.posts + c.videos}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { t, lang } = useAuth();
  const { memberName } = useData();
  const [bg, fg] = TASK_STATUS_COLORS[task.status];
  const done = task.status === "done";
  return (
    <div className="flex flex-wrap items-center gap-3 py-3.5 border-t border-line-soft">
      <Pill bg={bg} fg={fg}>
        {t(done ? "status.taskDone" : `status.${task.status}`)}
      </Pill>
      <button type="button" onClick={onOpen} className="flex-[1_1_220px] min-w-0 text-left flex flex-col gap-1 cursor-pointer">
        <span className={cx("text-[14px] font-medium", done ? "text-muted line-through" : "text-ink")}>{taskTitle(task, lang)}</span>
        {task.status === "revise" && task.reviewNote ? (
          <span className="text-[12px] text-danger">
            {t("dash.revisionNote")}
            {task.reviewNote}
          </span>
        ) : (
          task.subtasks.length > 0 && (
            <span className="text-[12px] text-muted">
              {t("task.subtaskCount", { a: task.subtasks.filter((s) => s.done).length, b: task.subtasks.length })}
            </span>
          )
        )}
      </button>
      <span className="text-[13px] text-ink-2 w-[110px] truncate">{task.assigneeEmails.map(memberName).join("、") || "—"}</span>
      <DueLabel date={task.due} done={done} className="text-[13px] w-[96px] text-right" />
      <div className="w-full sm:w-auto">
        <TaskActions task={task} />
      </div>
    </div>
  );
}

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang, isAdmin } = useAuth();
  const { projectById, tasks, events, memberName } = useData();
  const { deleteProject } = useActions();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [taskForm, setTaskForm] = useState<{ task?: Task } | null>(null);
  const project = projectById(id);

  if (!project)
    return (
      <Card>
        <p className="m-0 text-[14px] text-muted">{t("proj.notFound")}</p>
        <Link href="/projects" className="text-[14px]">
          ← {t("nav.projects")}
        </Link>
      </Card>
    );

  const ptasks = tasks
    .filter((x) => x.projectId === id)
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || a.due.localeCompare(b.due));
  const month = monthStr();
  const isSocial = project.services.some((s) => s.type === "social");
  const visibleTasks = isSocial ? ptasks.filter((x) => !x.cycle || x.cycle === month) : ptasks;
  const hasUniform = project.services.some((s) => s.type === "uniform");
  const pct = projectProgress(project, tasks);
  const [sbg, sfg] = PROJECT_STATUS_COLORS[project.status];

  const schedule = [
    { date: project.dueDate, title: t("evt.deliveryShort"), type: "delivery" as const },
    ...(project.outsourcing?.vendorEta
      ? [{ date: project.outsourcing.vendorEta, title: t("out.vendorEtaEvent", { name: project.outsourcing.vendorName || t("out.vendor") }), type: "deadline" as const }]
      : []),
    ...(project.outsourcing?.printerEta
      ? [{ date: project.outsourcing.printerEta, title: t("out.printerEtaEvent", { name: project.outsourcing.printerName || t("out.printer") }), type: "deadline" as const }]
      : []),
    ...events.filter((e) => e.projectId === id).map((e) => ({ date: e.date, title: e.title, type: e.type })),
  ]
    .filter((x) => x.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted flex gap-2 items-center">
          <Link href="/projects" className="no-underline">
            {t("nav.projects")}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{project.name}</span>
        </nav>
        <TopBar />
      </div>

      <Card className="flex flex-col gap-6 !p-6 !rounded-[16px]">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              {project.services.map((s, i) => (
                <ServiceTag key={i} type={s.type} variant={s.variant} />
              ))}
              <Pill bg={sbg} fg={sfg} round>
                {t(`status.${project.status}`)}
              </Pill>
            </div>
            <h1 className="m-0 text-[26px] font-bold">{project.name}</h1>
            <p className="m-0 text-[14px] text-muted">
              {project.client && `${t("proj.client")}：${project.client} · `}
              {t("proj.owner")}：{memberName(project.ownerEmail)} · {t("proj.members")}：{project.memberEmails.map(memberName).join("、")}
            </p>
          </div>
          <div className="flex flex-wrap gap-7 items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">{t("proj.start")}</span>
              <span className="text-[15px] font-medium">{formatDate(project.startDate, lang)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">{t("proj.due")}</span>
              <DueLabel date={project.dueDate} done={project.status === "done" || project.status === "cancelled"} className="text-[15px]" />
            </div>
            {project.budget && (
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-muted">{t("proj.budget")}</span>
                <span className="text-[15px] font-medium">{project.budget}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">{t("proj.progress")}</span>
              <span className="text-[18px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {pct}%
              </span>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button onClick={() => setEditing(true)}>{t("common.edit")}</Button>
                <Button
                  variant="danger"
                  aria-label={t("common.delete")}
                  onClick={async () => {
                    if (!confirm(t("proj.deleteConfirm"))) return;
                    await deleteProject(project.id);
                    router.push("/projects");
                  }}
                >
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <h2 className="m-0 text-[15px] font-bold">{t("proj.stages")}</h2>
          {project.services.map((s, i) => (
            <StageTrack key={i} project={project} svc={s} index={i} />
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-5 items-start">
        <div className="flex-[2_1_560px] min-w-0 flex flex-col gap-5">
          <Card className="flex flex-col gap-3.5 !p-[22px]">
            <div className="flex justify-between items-center gap-3">
              <h2 className="m-0 text-[15px] font-bold">
                {t("proj.tasks")}
                {isSocial && <span className="ml-2 text-[12px] font-normal text-muted">{formatMonth(month, lang)}</span>}
              </h2>
              {isAdmin && (
                <Button size="sm" variant="primary" onClick={() => setTaskForm({})}>
                  <Icon name="plus" size={14} />
                  {t("task.new")}
                </Button>
              )}
            </div>
            <div className="flex flex-col">
              {visibleTasks.length === 0 && <EmptyState>{t("task.empty")}</EmptyState>}
              {visibleTasks.map((x) => (
                <TaskRow key={x.id} task={x} onOpen={() => setTaskForm({ task: x })} />
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 !p-[22px]">
            <h2 className="m-0 text-[15px] font-bold">{t("proj.notes")}</h2>
            {project.notes ? (
              <p className="m-0 text-[14px] leading-relaxed text-ink-2 whitespace-pre-wrap">{project.notes}</p>
            ) : (
              <span className="text-[13px] text-faint">{t("common.none")}</span>
            )}
            <p className="m-0 text-[12px] text-faint">{t("proj.notesHint")}</p>
          </Card>
        </div>

        <div className="flex-[1_1_360px] min-w-0 flex flex-col gap-5">
          {hasUniform && <OutsourcingPanel key={project.id} project={project} />}
          {isSocial && <SocialPanel project={project} />}
          <Card className="flex flex-col gap-3 !p-[22px]">
            <h2 className="m-0 text-[15px] font-bold">{t("proj.schedule")}</h2>
            {schedule.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px]">
                <span aria-hidden="true" className="w-2 h-2 rounded-full flex-none" style={{ background: EVENT_COLORS[e.type].solid }} />
                <span className="w-[72px] flex-none text-muted">{formatDate(e.date, lang)}</span>
                <span>{e.title}</span>
              </div>
            ))}
            <span className="text-[12px] text-faint">{t("proj.scheduleHint")}</span>
          </Card>
        </div>
      </div>

      {editing && <ProjectForm open project={project} onClose={() => setEditing(false)} />}
      {taskForm && <TaskForm open task={taskForm.task} projectId={project.id} onClose={() => setTaskForm(null)} />}
    </>
  );
}
