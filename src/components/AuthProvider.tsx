"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { stageLabel, translate } from "@/lib/i18n";
import type { Lang, Member } from "@/lib/types";

type AuthState = "loading" | "signedOut" | "denied" | "inactive" | "ready" | "unconfigured";

interface Ctx {
  state: AuthState;
  user: User | null;
  member: Member | null;
  isAdmin: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  stage: (s: string) => string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  api: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}

const AuthCtx = createContext<Ctx | null>(null);

const LANG_KEY = "abound.lang";

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "zh" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(firebaseConfigured ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const stored = readStoredLang();
    if (stored) setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);

  const api = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const u = auth().currentUser;
      const token = u ? await u.getIdToken() : "";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      return data as T;
    },
    []
  );

  useEffect(() => {
    if (!firebaseConfigured) return;
    let unsubMember: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth(), async (u) => {
      unsubMember?.();
      unsubMember = null;
      setUser(u);
      setMember(null);
      if (!u || !u.email) {
        setState("signedOut");
        return;
      }
      setState("loading");
      const email = u.email.toLowerCase();
      // 第一次登录：若名单为空且是 ADMIN_EMAIL，服务器会建立管理员资料
      try {
        const token = await u.getIdToken();
        await fetch("/api/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      } catch {
        /* 忽略 */
      }
      unsubMember = onSnapshot(
        doc(db(), "members", email),
        (snap) => {
          if (!snap.exists()) {
            setState("denied");
            return;
          }
          const m = { ...(snap.data() as Member), email };
          setMember(m);
          if (!m.active) {
            setState("inactive");
            return;
          }
          if (m.lang && !readStoredLang()) setLangState(m.lang);
          setState("ready");
        },
        () => setState("denied")
      );
    });
    return () => {
      unsub();
      unsubMember?.();
    };
  }, []);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      try {
        localStorage.setItem(LANG_KEY, l);
      } catch {
        /* 忽略 */
      }
      if (member?.email) updateDoc(doc(db(), "members", member.email), { lang: l }).catch(() => {});
    },
    [member?.email]
  );

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth(), provider);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth());
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      state,
      user,
      member,
      isAdmin: member?.role === "admin" && member.active,
      lang,
      setLang,
      t: (k, v) => translate(lang, k, v),
      stage: (s) => stageLabel(lang, s),
      signIn,
      signOut,
      api,
    }),
    [state, user, member, lang, setLang, signIn, signOut, api]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
