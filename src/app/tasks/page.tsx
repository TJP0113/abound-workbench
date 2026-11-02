"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskActions, TaskKindTag } from "@/components/TaskBits";
import { Avatar, Button, DueLabel, Icon, PRIORITY_COLORS, PageHeader, ProgressBar, TASK_STATUS_COLORS, cx } from "@/components/ui";
import { useActions } from "@/lib/actions";
import { taskTitle } from "@/lib/project-utils";
import { addDays, todayStr, weekStart } from "@/lib/dates";
import type { Task, TaskStatus } from "@/lib/types";

const COLUMNS: TaskStatus[] = ["todo", "doing", "review", "revise", "done"];

function TaskCard({ task, onOpen, onDragStart }: { task: Task; onOpen: () => void; onDragStart: () => void }) {
  const { t, lang } = useAuth();
  const { memberName, members } = useData();
  const done = task.status === "done";
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <article
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-[#E2E2DD] rounded-[10px] p-3.5 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-center gap-2">
        <TaskKindTag task={task} />
        <span className="text-[12px] font-bold" style={{ color: PRIORITY_COLORS[task.priority] }}>
          {t(`pri.${task.priority}`)}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="text-left flex flex-col gap-1 cursor-pointer">
        <h3 className={cx("m-0 text-[14px] font-medium leading-snug", done && "line-through text-muted")}>{taskTitle(task, lang)}</h3>
        {task.projectName && <span className="text-[12px] text-muted">{task.projectName}</span>}
      </button>
      {task.status === "revise" && task.reviewNote && (
        <div className="text-[12px] leading-relaxed text-ink-2 bg-[#FCF1F1] rounded-lg px-2.5 py-2">
          <span className="text-danger font-medium">{t("dash.revisionNote")}</span>
          {task.reviewNote}
        </div>
      )}
      {task.subtasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">{t("task.subtaskCount", { a: subDone, b: task.subtasks.length })}</span>
          <ProgressBar pct={(subDone / task.subtasks.length) * 100} color="#2D45C8" />
        </div>
      )}
      <div className="flex justify-between items-center gap-2 pt-2.5 border-t border-line-soft">
        <div className="flex items-center gap-1.5 text-[12px] text-ink-2 min-w-0">
          {task.assigneeEmails.slice(0, 3).map((e) => (
            <Avatar key={e} email={e} name={members.find((m) => m.email === e)?.name ?? e} size={22} />
          ))}
          <span className="truncate">{task.assigneeEmails.map(memberName).join("、")}</span>
        </div>
        <DueLabel date={task.due} done={done} className="text-[12px]" />
      </div>
      <TaskActions task={task} />
    </article>
  );
}

function TasksInner() {
  const { t, isAdmin, member, api } = useAuth();
  const { tasks, members } = useData();
  const { setTaskStatus } = useActions();
  const params = useSearchParams();
  const router = useRouter();
  const [who, setWho] = useState<string>(isAdmin ? "all" : "mine");
  const [form, setForm] = useState<{ task?: Task; routine?: boolean } | null>(null);
  const [kind, setKind] = useState<"all" | "project" | "routine">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const today = todayStr();

  // 从通知打开指定任务
  useEffect(() => {
    const id = params.get("task");
    if (!id) return;
    const tk = tasks.find((x) => x.id === id);
    if (tk) setForm({ task: tk });
  }, [params, tasks]);

  const filtered = tasks.filter((x) => {
    if (kind === "routine" && x.kind !== "routine") return false;
    if (kind === "project" && x.kind === "routine") return false;
    if (who === "all") return true;
    if (who === "mine") return !!member && x.assigneeEmails.includes(member.email);
    return x.assigneeEmails.includes(who);
  });

  const load = useMemo(() => {
    const we = addDays(weekStart(today), 6);
    const map: Record<string, number> = {};
    for (const x of tasks) {
      if (x.status === "done" || x.due > we) continue;
      for (const e of x.assigneeEmails) map[e] = (map[e] || 0) + 1;
    }
    return map;
  }, [tasks, today]);

  const drop = async (status: TaskStatus) => {
    const tk = tasks.find((x) => x.id === dragId);
    setDragId(null);
    if (!tk || tk.status === status) return;
    const mine = !!member && tk.assigneeEmails.includes(member.email);
    // 日常事务：不经审核，拖到「已完成」直接完成
    if (tk.kind === "routine") {
      if (!isAdmin && !mine) return;
      if (status === "review" || status === "revise") return;
      if (status === "done") {
        await api("/api/routine/complete", { id: tk.id }).catch(() => alert(t("err.permission")));
        return;
      }
      await setTaskStatus(tk, status).catch(() => alert(t("err.permission")));
      return;
    }
    // 员工：只能在 待开始 / 进行中 / 待审核 之间移动；打回与批准由管理员操作
    if (!isAdmin && (!mine || !["todo", "doing", "review"].includes(status))) return;
    if (status === "revise") {
      setForm({ task: tk });
      return;
    }
    await setTaskStatus(tk, status).catch(() => alert(t("err.permission")));
  };

  const closeForm = () => {
    setForm(null);
    if (params.get("task")) router.replace("/tasks");
  };

  const active = members.filter((m) => m.active);

  return (
    <>
      <PageHeader
        title={t("task.title")}
        sub={t("task.hint")}
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              {t("task.typeFilter")}
              <select className="field !w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="all">{t("common.all")}</option>
                <option value="project">{t("task.kind.project")}</option>
                <option value="routine">{t("task.kind.routine")}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              {t("task.assigneeFilter")}
              <select className="field !w-auto" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="all">{t("common.all")}</option>
                <option value="mine">{t("common.mine")}</option>
                {isAdmin &&
                  active.map((m) => (
                    <option key={m.email} value={m.email}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <TopBar />
            {isAdmin && (
              <>
                <Button onClick={() => setForm({ routine: true })}>
                  <Icon name="plus" size={16} />
                  {t("task.newRoutine")}
                </Button>
                <Button variant="primary" onClick={() => setForm({})}>
                  <Icon name="plus" size={16} />
                  {t("task.new")}
                </Button>
              </>
            )}
          </>
        }
      />

      {isAdmin && (
        <section aria-labelledby="load" className="bg-card border border-line rounded-[14px] px-5 py-4 flex flex-wrap items-center gap-x-7 gap-y-3">
          <h2 id="load" className="m-0 text-[14px] font-bold">
            {t("task.workload")}
          </h2>
          {active.map((m) => {
            const n = load[m.email] || 0;
            const heavy = n >= 7;
            return (
              <div key={m.email} className="flex items-center gap-2.5">
                <Avatar name={m.name} email={m.email} />
                <div className="flex flex-col gap-1 w-[120px]">
                  <div className="flex justify-between text-[12px]">
                    <span className="truncate">{m.name}</span>
                    <span className="font-semibold" style={{ fontFamily: "var(--font-display)", color: heavy ? "#8A5A00" : undefined }}>
                      {n}
                    </span>
                  </div>
                  <ProgressBar pct={(n / 8) * 100} color={heavy ? "#C98A12" : "#18191B"} />
                </div>
              </div>
            );
          })}
          <span className="text-[12px] text-faint ml-auto">{t("task.workloadHint")}</span>
        </section>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3 min-w-[1080px]" style={{ gridTemplateColumns: "repeat(5, minmax(210px, 1fr))" }}>
          {COLUMNS.map((col) => {
            let list = filtered.filter((x) => x.status === col).sort((a, b) => a.due.localeCompare(b.due));
            const total = list.length;
            if (col === "done") {
              list = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
              if (!showAllDone) list = list.slice(0, 10);
            }
            return (
              <section
                key={col}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(col)}
                className="bg-[#EBEBE6] rounded-[14px] p-3 flex flex-col gap-2.5 min-h-[240px]"
              >
                <div className="flex items-center justify-between px-1.5 py-1">
                  <h2 className="m-0 text-[14px] font-bold flex items-center gap-2">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: TASK_STATUS_COLORS[col][2] }} />
                    {t(col === "done" ? "status.taskDone" : `status.${col}`)}
                  </h2>
                  <span className="text-[13px] font-semibold text-[#4A4C51]" style={{ fontFamily: "var(--font-display)" }}>
                    {total}
                  </span>
                </div>
                {list.map((x) => (
                  <TaskCard key={x.id} task={x} onOpen={() => setForm({ task: x })} onDragStart={() => setDragId(x.id)} />
                ))}
                {col === "done" && total > 10 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowAllDone((v) => !v)}>
                    {showAllDone ? "−" : t("common.viewAll")}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {form && <TaskForm open task={form.task} routine={form.routine} onClose={closeForm} />}
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksInner />
    </Suspense>
  );
}
