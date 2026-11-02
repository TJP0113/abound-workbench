"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Field, Modal, ServiceTag } from "./ui";
import { useActions } from "@/lib/actions";
import type { Task } from "@/lib/types";

/** 按角色与状态显示的任务操作：开始 / 提交审核 / 批准 / 打回 */
export function TaskActions({ task, size = "sm" }: { task: Task; size?: "sm" | "md" }) {
  const { t, isAdmin, member, api } = useAuth();
  const { setTaskStatus } = useActions();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = !!member && task.assigneeEmails.includes(member.email);

  const go = async (s: Task["status"], n?: string) => {
    setBusy(true);
    try {
      await setTaskStatus(task, s, n);
    } catch (e) {
      console.error(e);
      alert(t("err.permission"));
    } finally {
      setBusy(false);
    }
  };

  const completeRoutine = async () => {
    setBusy(true);
    try {
      await api("/api/routine/complete", { id: task.id });
    } catch (e) {
      console.error(e);
      alert(t("err.permission"));
    } finally {
      setBusy(false);
    }
  };

  const buttons: React.ReactNode[] = [];
  if (task.kind === "routine") {
    if ((mine || isAdmin) && task.status !== "done") {
      if (task.status === "todo")
        buttons.push(
          <Button key="start" size={size} disabled={busy} onClick={() => go("doing")} className="flex-1">
            {t("task.start")}
          </Button>
        );
      buttons.push(
        <Button key="done" size={size} variant="dark" disabled={busy} onClick={completeRoutine} className="flex-1">
          {t("task.complete")}
        </Button>
      );
    }
  } else if (task.status === "review" && isAdmin) {
    buttons.push(
      <Button key="ok" size={size} variant="dark" disabled={busy} onClick={() => go("done")} className="flex-1">
        {t("task.approve")}
      </Button>,
      <Button key="no" size={size} variant="danger" disabled={busy} onClick={() => setRejecting(true)} className="flex-1">
        {t("task.reject")}
      </Button>
    );
  } else if (mine || isAdmin) {
    if (task.status === "todo")
      buttons.push(
        <Button key="start" size={size} disabled={busy} onClick={() => go("doing")} className="flex-1">
          {t("task.start")}
        </Button>
      );
    if (task.status === "doing" || task.status === "revise")
      buttons.push(
        <Button key="submit" size={size} variant="primary" disabled={busy} onClick={() => go("review")} className="flex-1">
          {task.status === "revise" ? t("task.resubmit") : t("task.submit")}
        </Button>
      );
  }

  return (
    <>
      {buttons.length > 0 && (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {buttons}
        </div>
      )}
      {rejecting && (
        <Modal
          open
          onClose={() => setRejecting(false)}
          title={t("task.rejectTitle")}
          footer={
            <>
              <Button onClick={() => setRejecting(false)}>{t("common.cancel")}</Button>
              <Button
                variant="danger"
                disabled={!note.trim() || busy}
                onClick={async () => {
                  await go("revise", note.trim());
                  setRejecting(false);
                  setNote("");
                }}
              >
                {t("task.reject")}
              </Button>
            </>
          }
        >
          <Field label={t("task.reviewNote")} hint={t("task.reviewNoteHint")} required>
            <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          </Field>
        </Modal>
      )}
    </>
  );
}

/** 任务标签：项目任务显示服务类型，日常事务显示「日常」与重复周期 */
export function TaskKindTag({ task }: { task: Task }) {
  const { t } = useAuth();
  if (task.kind === "routine")
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-medium whitespace-nowrap bg-[#ECEDEF] text-[#3A3C40]">
        {t("task.routineTag")}
        {task.repeat && task.repeat !== "none" ? ` · ${t(`repeat.${task.repeat}`)}` : ""}
      </span>
    );
  return task.serviceType ? <ServiceTag type={task.serviceType} /> : null;
}
