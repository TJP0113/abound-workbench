"use client";

import { useCallback, useMemo } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { translate } from "./i18n";
import { monthStr, todayStr } from "./dates";
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
      // 成员改变：Order Form 与其图片的权限也跟着改
      if (isAdmin && membersChanged) {
        for (const c of ["orderForms", "orderImages"]) {
          const snap = await getDocs(query(collection(db(), c), where("projectId", "==", id)));
          const batch = writeBatch(db());
          snap.forEach((d) => batch.update(d.ref, { memberEmails: patch.memberEmails }));
          await batch.commit();
        }
      }
      if (patch.services?.some((s) => s.type === "social")) await api("/api/maintenance").catch(() => {});
      requestSync();
    },
    [api, isAdmin, requestSync]
  );

  /** 放入回收站（30 天后自动永久删除） */
  const deleteProject = useCallback(
    async (id: string) => {
      await updateDoc(doc(db(), "projects", id), { deletedAt: Date.now(), deletedBy: me });
      requestSync();
    },
    [me, requestSync]
  );

  const restoreProject = useCallback(
    async (id: string) => {
      await updateDoc(doc(db(), "projects", id), { deletedAt: null, updatedAt: Date.now() });
      requestSync();
    },
    [requestSync]
  );

  /** 永久删除：连同任务、Order Form、图片 */
  const purgeProject = useCallback(async (id: string) => {
    const refs = [doc(db(), "projects", id)];
    for (const c of ["tasks", "orderForms", "orderImages"]) {
      const snap = await getDocs(query(collection(db(), c), where("projectId", "==", id)));
      snap.forEach((d) => refs.push(d.ref));
    }
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db());
      refs.slice(i, i + 400).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }, []);

  /** 复制项目：阶段归零、日期清空；可选连同 Order Form（含图片）一起复制。任务不复制。 */
  const duplicateProject = useCallback(
    async (src: Project, name: string, withForms: boolean): Promise<string> => {
      const month = monthStr();
      const today = todayStr();
      const services = src.services.map((s) => {
        const svc = { ...s, current: 0 };
        if (s.social)
          svc.social = {
            ...s.social,
            cycles: [],
            startMonth: s.social.startMonth > month ? s.social.startMonth : month,
            endMonth: s.social.endMonth && s.social.endMonth >= month ? s.social.endMonth : null,
          };
        return svc;
      });
      const outsourcing = src.outsourcing ? { ...src.outsourcing, orderDate: "", vendorEta: "", printerEta: "" } : undefined;
      const data = clean({
        name,
        client: src.client,
        startDate: today,
        dueDate: "",
        ownerEmail: src.ownerEmail,
        memberEmails: src.memberEmails,
        status: "active",
        services,
        notes: src.notes,
        outsourcing,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const ref = await addDoc(collection(db(), "projects"), data);
      if (withForms) {
        const forms = await getDocs(query(collection(db(), "orderForms"), where("projectId", "==", src.id)));
        const copyImg = async (id?: string) => {
          if (!id) return id;
          const snap = await getDoc(doc(db(), "orderImages", id));
          const img = snap.data()?.data as string | undefined;
          if (!img) return undefined;
          const r = await addDoc(collection(db(), "orderImages"), { data: img, projectId: ref.id, memberEmails: src.memberEmails, createdAt: Date.now() });
          return r.id;
        };
        for (const d of forms.docs) {
          const f = d.data();
          const images = [];
          for (const im of (f.images || []) as { id: string; caption?: string }[]) {
            const nid = await copyImg(im.id);
            if (nid) images.push({ ...im, id: nid });
          }
          await addDoc(
            collection(db(), "orderForms"),
            clean({
              ...f,
              projectId: ref.id,
              memberEmails: src.memberEmails,
              orderDate: today,
              deliveryDate: "",
              frontImage: await copyImg(f.frontImage),
              backImage: await copyImg(f.backImage),
              images: f.images ? images : undefined,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          );
        }
      }
      if (services.some((s) => s.type === "social")) await api("/api/maintenance").catch(() => {});
      requestSync();
      return ref.id;
    },
    [api, requestSync]
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
    restoreProject,
    purgeProject,
    duplicateProject,
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
