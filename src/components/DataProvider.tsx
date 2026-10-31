"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppNotification, CalEvent, Member, Project, Task } from "@/lib/types";
import { useAuth } from "./AuthProvider";

interface Data {
  loaded: boolean;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  events: CalEvent[];
  notifications: AppNotification[];
  memberName: (email: string) => string;
  projectById: (id: string) => Project | undefined;
}

const DataCtx = createContext<Data | null>(null);

function useCollection<T>(q: Query | null, deps: unknown[]): [T[], boolean] {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!q) {
      setItems([]);
      setLoaded(false);
      return;
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })));
        setLoaded(true);
      },
      (err) => {
        console.error("[data]", err);
        setLoaded(true);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [items, loaded];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { state, member, isAdmin } = useAuth();
  const ready = state === "ready" && !!member;
  const email = member?.email ?? "";

  const [membersRaw, mLoaded] = useCollection<Member & { id: string }>(
    ready ? collection(db(), "members") : null,
    [ready]
  );
  const [projects, pLoaded] = useCollection<Project>(
    ready
      ? isAdmin
        ? collection(db(), "projects")
        : query(collection(db(), "projects"), where("memberEmails", "array-contains", email))
      : null,
    [ready, isAdmin, email]
  );
  const [tasks, tLoaded] = useCollection<Task>(
    ready
      ? isAdmin
        ? collection(db(), "tasks")
        : query(collection(db(), "tasks"), where("memberEmails", "array-contains", email))
      : null,
    [ready, isAdmin, email]
  );
  const [events, eLoaded] = useCollection<CalEvent>(ready ? collection(db(), "events") : null, [ready]);
  const [notifsRaw] = useCollection<AppNotification>(
    ready ? query(collection(db(), "notifications"), where("toEmail", "==", email)) : null,
    [ready, email]
  );

  const value = useMemo<Data>(() => {
    const members = membersRaw.map((m) => ({ ...m, email: m.id })).sort((a, b) => a.name.localeCompare(b.name));
    const byEmail = new Map(members.map((m) => [m.email, m]));
    const byId = new Map(projects.map((p) => [p.id, p]));
    return {
      loaded: mLoaded && pLoaded && tLoaded && eLoaded,
      members,
      projects,
      tasks,
      events,
      notifications: [...notifsRaw].sort((a, b) => b.createdAt - a.createdAt),
      memberName: (e) => byEmail.get(e)?.name || e.split("@")[0],
      projectById: (id) => byId.get(id),
    };
  }, [membersRaw, projects, tasks, events, notifsRaw, mLoaded, pLoaded, tLoaded, eLoaded]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): Data {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData outside DataProvider");
  return c;
}
