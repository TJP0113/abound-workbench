"use client";

import { useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { Button, Field, Modal, Segmented, cx } from "./ui";
import { useActions } from "@/lib/actions";
import { addDays, todayStr, weekStart } from "@/lib/dates";
import { taskTitle } from "@/lib/project-utils";
import type { Priority, Repeat, Subtask, Task, TaskStatus } from "@/lib/types";

const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly"];

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const STATUSES: TaskStatus[] = ["todo", "doing", "review", "revise", "done"];

/** 新建 / 编辑任务（管理员）；员工打开时只能改子任务 */
export function TaskForm({
  open,
  onClose,
  task,
  projectId,
  routine,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  projectId?: string;
  routine?: boolean; // 默认建立日常事务
}) {
  const { t, lang, isAdmin, member } = useAuth();
  const { projects, members, tasks } = useData();
  const { createTask, updateTask, deleteTask } = useActions();
  const today = todayStr();
  const openProjects = projects.filter((p) => p.status !== "cancelled" && (p.status !== "done" || p.id === task?.projectId));

  const [f, setF] = useState(() => ({
    kind: (task ? (task.kind === "routine" ? "routine" : "project") : routine || !openProjects.length ? "routine" : "project") as "project" | "routine",
    repeat: (task?.repeat ?? "none") as Repeat,
    projectId: task?.projectId ?? projectId ?? openProjects[0]?.id ?? "",
    title: task ? taskTitle(task, lang) : "",
    description: task?.description ?? "",
    assigneeEmails: task?.assigneeEmails ?? [],
    due: task?.due ?? addDays(today, 3),
    priority: task?.priority ?? ("medium" as Priority),
    status: task?.status ?? ("todo" as TaskStatus),
    subtasks: task?.subtasks ?? ([] as Subtask[]),
    note: task?.note ?? "",
    reviewNote: task?.reviewNote ?? "",
  }));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }));

  const isRoutineKind = f.kind === "routine";
  const project = isRoutineKind ? undefined : projects.find((p) => p.id === f.projectId);
  const candidates = members.filter((m) => m.active && (isRoutineKind || !project || project.memberEmails.includes(m.email)));
  // 日常事务：负责人与管理员都看得到
  const routineMembers = (assignees: string[]) =>
    Array.from(new Set([...assignees, ...members.filter((m) => m.role === "admin" && m.active).map((m) => m.email)]));

  // 分配前看工作量：本周（周一到周日）未完成任务数
  const load = useMemo(() => {
    const ws = weekStart(today);
    const we = addDays(ws, 6);
    const map: Record<string, number> = {};
    for (const x of tasks) {
      if (x.status === "done" || x.due > we) continue;
      for (const e of x.assigneeEmails) map[e] = (map[e] || 0) + 1;
    }
    return map;
  }, [tasks, today]);

  const canEditAll = isAdmin;
  const isAssignee = !!task && !!member && task.assigneeEmails.includes(member.email);

  const save = async () => {
    if (canEditAll && (!f.title.trim() || (!isRoutineKind && !f.projectId) || !f.due)) {
      setError(t("common.required"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!canEditAll && task) {
        await updateTask(task.id, { subtasks: f.subtasks });
      } else if (task) {
        const titleChanged = f.title.trim() !== taskTitle(task, lang);
        await updateTask(
          task.id,
          {
            ...(isRoutineKind
              ? { projectId: "", projectName: "", memberEmails: routineMembers(f.assigneeEmails), repeat: f.repeat, kind: "routine" as const }
              : {
                  projectId: f.projectId,
                  projectName: project?.name ?? task.projectName,
                  memberEmails: project?.memberEmails ?? task.memberEmails,
                }),
            title: f.title.trim(),
            description: f.description,
            assigneeEmails: f.assigneeEmails,
            due: f.due,
            priority: f.priority,
            status: f.status,
            subtasks: f.subtasks,
            note: f.note,
            reviewNote: f.reviewNote,
          },
          task
        );
        if (titleChanged && task.autoTitle) {
          // 去掉自动标题，改用手动标题
          const { deleteField, doc, updateDoc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          await updateDoc(doc(db(), "tasks", task.id), { autoTitle: deleteField() });
        }
      } else if (isRoutineKind) {
        await createTask({
          kind: "routine",
          repeat: f.repeat,
          projectId: "",
          projectName: "",
          memberEmails: routineMembers(f.assigneeEmails),
          title: f.title.trim(),
          description: f.description,
          assigneeEmails: f.assigneeEmails,
          due: f.due,
          priority: f.priority,
          status: "todo",
          subtasks: f.subtasks,
          note: f.note,
        });
      } else {
        await createTask({
          kind: "project",
          projectId: f.projectId,
          projectName: project?.name ?? "",
          serviceType: project?.services[0]?.type,
          memberEmails: project?.memberEmails ?? [],
          title: f.title.trim(),
          description: f.description,
          assigneeEmails: f.assigneeEmails,
          due: f.due,
          priority: f.priority,
          status: "todo",
          subtasks: f.subtasks,
          note: f.note,
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError(t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!task || !confirm(t("common.confirmDelete"))) return;
    await deleteTask(task.id);
    onClose();
  };

  const ro = !canEditAll;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? (ro ? taskTitle(task, lang) : t("task.edit")) : t("task.new")}
      footer={
        <>
          {error && <span className="mr-auto self-center text-[13px] text-danger">{error}</span>}
          {task && canEditAll && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              {t("common.delete")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          {(canEditAll || isAssignee) && (
            <Button variant="primary" onClick={save} disabled={busy}>
              {t("common.save")}
            </Button>
          )}
        </>
      }
    >
      {canEditAll && (
        <>
          {!task && (
            <Segmented
              label={t("task.kind")}
              value={f.kind}
              onChange={(k) => up({ kind: k, assigneeEmails: [] })}
              options={[
                { value: "project", label: t("task.kind.project") },
                { value: "routine", label: t("task.kind.routine") },
              ]}
            />
          )}
          {isRoutineKind ? (
            <Field label={t("task.repeat")} hint={t("task.repeatHint")}>
              <select className="field" value={f.repeat} onChange={(e) => up({ repeat: e.target.value as Repeat })}>
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {t(`repeat.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
          ) : !openProjects.length ? (
            <p className="m-0 text-[13px] text-muted">{t("task.noProjects")}</p>
          ) : (
          <Field label={t("task.project")} required>
            <select
              className="field"
              value={f.projectId}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                up({ projectId: e.target.value, assigneeEmails: f.assigneeEmails.filter((a) => p?.memberEmails.includes(a)) });
              }}
            >
              {openProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.client ? ` · ${p.client}` : ""}
                </option>
              ))}
            </select>
          </Field>
          )}
          <Field label={t("task.name")} required>
            <input className="field" value={f.title} onChange={(e) => up({ title: e.target.value })} />
          </Field>
          <Field label={t("task.desc")}>
            <textarea className="field" value={f.description} onChange={(e) => up({ description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={t("task.due")} required>
              <input type="date" className="field" value={f.due} onChange={(e) => up({ due: e.target.value })} />
            </Field>
            <Field label={t("task.priority")}>
              <select className="field" value={f.priority} onChange={(e) => up({ priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`pri.${p}`)}
                  </option>
                ))}
              </select>
            </Field>
            {task && (
              <Field label={t("proj.status")}>
                <select className="field" value={f.status} onChange={(e) => up({ status: e.target.value as TaskStatus })}>
                  {STATUSES.filter((s) => !isRoutineKind || (s !== "review" && s !== "revise")).map((s) => (
                    <option key={s} value={s}>
                      {t(s === "done" ? "status.taskDone" : `status.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
            <legend className="text-[13px] font-medium text-ink-2 mb-1.5">{t("task.assignees")}</legend>
            <div className="flex flex-wrap gap-2">
              {candidates.map((m) => {
                const on = f.assigneeEmails.includes(m.email);
                const n = load[m.email] || 0;
                return (
                  <label
                    key={m.email}
                    className={cx(
                      "flex items-center gap-2 min-h-[40px] px-3 rounded-lg border text-[13px] cursor-pointer",
                      on ? "border-ink bg-ink text-white" : "border-[#DCDCD6] bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        up({ assigneeEmails: e.target.checked ? [...f.assigneeEmails, m.email] : f.assigneeEmails.filter((x) => x !== m.email) })
                      }
                    />
                    {m.name}
                    <span className={cx("text-[11px]", on ? "text-white/80" : n >= 7 ? "text-warn font-bold" : "text-faint")}>
                      {t("task.weekLoad", { n })}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </>
      )}

      {ro && task && (
        <div className="flex flex-col gap-2 text-[14px]">
          <div className="text-muted text-[13px]">{task.projectName}</div>
          {task.description && <p className="m-0 whitespace-pre-wrap leading-relaxed">{task.description}</p>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-2">{t("task.subtasks")}</span>
        {f.subtasks.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="w-5 h-5 accent-[#2D45C8]"
              checked={s.done}
              disabled={ro && !isAssignee}
              aria-label={s.text}
              onChange={(e) => up({ subtasks: f.subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
            />
            <span className={cx("flex-1 text-[14px]", s.done && "line-through text-muted")}>{s.text}</span>
            {canEditAll && (
              <button
                type="button"
                aria-label={t("common.delete")}
                className="w-9 h-9 rounded-lg text-danger hover:bg-danger-soft cursor-pointer"
                onClick={() => up({ subtasks: f.subtasks.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {canEditAll && (
          <div className="flex gap-2">
            <input
              className="field !min-h-[38px]"
              value={draft}
              placeholder={t("task.addSubtask")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  up({ subtasks: [...f.subtasks, { text: draft.trim(), done: false }] });
                  setDraft("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!draft.trim()) return;
                up({ subtasks: [...f.subtasks, { text: draft.trim(), done: false }] });
                setDraft("");
              }}
            >
              {t("common.add")}
            </Button>
          </div>
        )}
      </div>

      {canEditAll ? (
        <Field label={t("task.note")}>
          <textarea className="field" value={f.note} onChange={(e) => up({ note: e.target.value })} />
        </Field>
      ) : (
        task?.note && (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-ink-2">{t("task.note")}</span>
            <p className="m-0 text-[14px] whitespace-pre-wrap">{task.note}</p>
          </div>
        )
      )}
      {task?.status === "revise" && task.reviewNote && (
        <div className="text-[13px] leading-relaxed bg-[#FCF1F1] rounded-[10px] px-3 py-2.5">
          <span className="text-danger font-medium">{t("dash.revisionNote")}</span>
          {task.reviewNote}
        </div>
      )}
    </Modal>
  );
}
