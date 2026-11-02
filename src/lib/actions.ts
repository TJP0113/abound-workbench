"use client";

import { useCallback, useMemo } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { translate } from "./i18n";
import type { AppNotification, CalEvent, Member, NotificationType, Project, Task, TaskStatus } from "./types";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** 把 undefined 字段去掉（Firestore 不接受 undefined） */
function clean<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export function useActions() {
  const { member, api, isAdmin } = useAuth();
  const { members, memberName } = useData();
  const me = member?.email ?? "";

  /** 日历相关资料改动后，延迟 2 秒请求同步 Google Calendar */
  const requestSync = useCallback(() => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      api("/api/gcal/sync").catch(() => {});
    }, 2000);
  }, [api]);

  const notify = useCallback(
    async (to: string[], type: NotificationType, vars: Record<string, string>, link: string) => {
      const targets = Array.from(new Set(to)).filter((e) => e && e !== me);
      if (!targets.length) return;
      const full = { from: memberName(me), ...vars };
      const batch = writeBatch(db());
      const ids: string[] = [];
      for (const toEmail of targets) {
        const n: Omit<AppNotification, "id"> = {
          toEmail,
          type,
          text: translate("zh", `notif.${type}`, full),
          textEn: translate("en", `notif.${type}`, full),
          link,
          read: false,
          createdAt: Date.now(),
          fromEmail: me,
        };
        const ref = doc(collection(db(), "notifications"));
        ids.push(ref.id);
        batch.set(ref, n);
      }
      try {
        await batch.commit();
        // 同时推送到对方的电脑 / 手机（失败不影响站内通知）
        api("/api/push/send", { ids }).catch(() => {});
      } catch (e) {
        console.error("[notify]", e);
      }
    },
    [me, memberName, api]
  );

  const adminEmails = useMemo(() => members.filter((m) => m.role === "admin" && m.active).map((m) => m.email), [members]);

  // ---------- 项目 ----------
  const createProject = useCallback(
    async (p: Omit<Project, "id">) => {
      const ref = await addDoc(collection(db(), "projects"), clean({ ...p, createdAt: Date.now(), updatedAt: Date.now() }));
      if (p.services.some((s) => s.type === "social")) await api("/api/maintenance").catch(() => {});
      requestSync();
      return ref.id;
    },
    [api, requestSync]
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>, prev?: Project) => {
      await updateDoc(doc(db(), "projects", id), clean({ ...patch, updatedAt: Date.now() }));
      // 成员或名称改变：同步到任务
      const membersChanged = patch.memberEmails && prev && patch.memberEmails.join() !== prev.memberEmails.join();
      const nameChanged = patch.name && prev && patch.name !== prev.name;
      if (isAdmin && (membersChanged || nameChanged)) {
        const snap = await getDocs(query(collection(db(), "tasks"), where("projectId", "==", id)));
        const batch = writeBatch(db());
        snap.forEach((d) =>
          batch.update(d.ref, clean({ memberEmails: patch.memberEmails ?? prev!.memberEmails, projectName: patch.name ?? prev!.name }))
        );
        await batch.commit();
      }
      if (patch.services?.some((s) => s.type === "social")) await api("/api/maintenance").catch(() => {});
      requestSync();
    },
    [api, isAdmin, requestSync]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const snap = await getDocs(query(collection(db(), "tasks"), where("projectId", "==", id)));
      const batch = writeBatch(db());
      snap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db(), "projects", id));
      await batch.commit();
      requestSync();
    },
    [requestSync]
  );

  // ---------- 任务 ----------
  const createTask = useCallback(
    async (t: Omit<Task, "id">) => {
      const ref = await addDoc(collection(db(), "tasks"), clean({ ...t, createdAt: Date.now(), updatedAt: Date.now() }));
      await notify(t.assigneeEmails, "assigned", { title: t.title }, `/tasks?task=${ref.id}`);
      requestSync();
      return ref.id;
    },
    [notify, requestSync]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>, prev?: Task) => {
      await updateDoc(doc(db(), "tasks", id), clean({ ...patch, updatedAt: Date.now() }));
      if (patch.assigneeEmails && prev) {
        const added = patch.assigneeEmails.filter((e) => !prev.assigneeEmails.includes(e));
        await notify(added, "assigned", { title: patch.title ?? prev.title }, `/tasks?task=${id}`);
      }
      if (patch.due !== undefined || patch.title !== undefined || patch.status !== undefined) requestSync();
      // 日常事务完成：建立下一次
      if (prev?.kind === "routine" && patch.status === "done" && prev.status !== "done") api("/api/maintenance").catch(() => {});
    },
    [notify, requestSync, api]
  );

  const setTaskStatus = useCallback(
    async (t: Task, status: TaskStatus, reviewNote?: string) => {
      const patch: Partial<Task> = { status };
      if (status === "revise") patch.reviewNote = reviewNote ?? "";
      await updateDoc(doc(db(), "tasks", t.id), clean({ ...patch, updatedAt: Date.now() }));
      const link = `/tasks?task=${t.id}`;
      if (status === "review") await notify(adminEmails, "submitted", { title: t.title }, link);
      if (status === "revise") await notify(t.assigneeEmails, "rejected", { title: t.title }, link);
      if (status === "done" && t.status === "review") await notify(t.assigneeEmails, "approved", { title: t.title }, link);
      if (status === "done" && t.kind === "routine") api("/api/maintenance").catch(() => {});
      requestSync();
    },
    [adminEmails, notify, requestSync, api]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db(), "tasks", id));
      requestSync();
    },
    [requestSync]
  );

  // ---------- 日程 ----------
  const saveEvent = useCallback(
    async (e: Omit<CalEvent, "id">, id?: string) => {
      const data = clean({ ...e, updatedAt: Date.now() });
      if (id) await setDoc(doc(db(), "events", id), data);
      else await addDoc(collection(db(), "events"), { ...data, createdAt: Date.now(), createdBy: me, source: "app" });
      if (id) await notify(e.attendeeEmails, "eventChanged", { title: e.title }, "/calendar");
      requestSync();
    },
    [me, notify, requestSync]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db(), "events", id));
      requestSync();
    },
    [requestSync]
  );

  // ---------- 员工 ----------
  const saveMember = useCallback(async (m: Member) => {
    const email = m.email.trim().toLowerCase();
    await setDoc(doc(db(), "members", email), clean({ ...m, email }), { merge: true });
  }, []);

  // ---------- 通知 ----------
  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const batch = writeBatch(db());
    ids.forEach((id) => batch.update(doc(db(), "notifications", id), { read: true }));
    await batch.commit();
  }, []);

  return {
    createProject,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    setTaskStatus,
    deleteTask,
    saveEvent,
    deleteEvent,
    saveMember,
    markRead,
    requestSync,
  };
}
