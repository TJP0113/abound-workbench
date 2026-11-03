"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { Avatar, Icon, cx } from "./ui";
import { useActions } from "@/lib/actions";
import { formatDateTime } from "@/lib/dates";
import { refreshPush } from "@/lib/push";

const NAV = [
  { href: "/", key: "nav.dashboard", icon: "dashboard" },
  { href: "/projects", key: "nav.projects", icon: "folder" },
  { href: "/tasks", key: "nav.tasks", icon: "check" },
  { href: "/calendar", key: "nav.calendar", icon: "calendar" },
  { href: "/team", key: "nav.team", icon: "team", admin: true },
  { href: "/settings", key: "nav.settings", icon: "settings" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function LangToggle({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useAuth();
  return (
    <div
      role="group"
      aria-label="Language / 界面语言"
      className={cx("flex p-[3px] rounded-[10px] h-11 box-border", dark ? "bg-[#2C2E33]" : "border border-[#E1E1DC] bg-white")}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cx(
            "px-3 rounded-[7px] text-[13px] font-medium cursor-pointer",
            lang === l ? (dark ? "bg-white text-ink" : "bg-ink text-white") : dark ? "text-[#C9CAD0]" : "text-muted"
          )}
          style={l === "en" ? { fontFamily: "var(--font-display)" } : undefined}
        >
          {l === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}

function NotificationBell() {
  const { t, lang } = useAuth();
  const { notifications } = useData();
  const { markRead } = useActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label={`${t("notif.title")}${unread.length ? ` (${unread.length})` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative w-11 h-11 rounded-[10px] border border-[#E1E1DC] bg-white flex items-center justify-center cursor-pointer"
      >
        <Icon name="bell" />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#C42B2B] text-white text-[10px] font-bold flex items-center justify-center"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[52px] z-30 w-[min(360px,calc(100vw-32px))] bg-white border border-line rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,.12)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <span className="text-[14px] font-bold">{t("notif.title")}</span>
            {unread.length > 0 && (
              <button type="button" className="text-[12px] text-accent cursor-pointer" onClick={() => markRead(unread.map((n) => n.id))}>
                {t("notif.markAll")}
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-faint">{t("notif.empty")}</div>}
            {notifications.slice(0, 40).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.read) markRead([n.id]);
                  setOpen(false);
                  router.push(n.link);
                }}
                className={cx(
                  "w-full text-left px-4 py-3 border-b border-line-soft flex gap-3 cursor-pointer hover:bg-well",
                  !n.read && "bg-[#F5F7FE]"
                )}
              >
                <span aria-hidden="true" className={cx("mt-1.5 w-2 h-2 rounded-full flex-none", n.read ? "bg-transparent" : "bg-accent")} />
                <span className="flex flex-col gap-1">
                  <span className="text-[13px] leading-snug">{lang === "zh" ? n.text : n.textEn}</span>
                  <span className="text-[11px] text-faint">{formatDateTime(n.createdAt, lang)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  return (
    <div className="flex items-center gap-2.5">
      <LangToggle />
      <NotificationBell />
    </div>
  );
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-[14px] text-muted">{children}</div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, member, isAdmin, t, signOut, api } = useAuth();
  const { loaded } = useData();
  const path = usePathname();
  const router = useRouter();
  const isLogin = path === "/login";

  useEffect(() => {
    if (isLogin) return;
    if (state === "signedOut" || state === "denied" || state === "inactive" || state === "unconfigured") router.replace("/login");
  }, [state, isLogin, router]);

  // 打开工作台时、之后每 5 分钟，从 Google Calendar 读回改动
  useEffect(() => {
    if (state !== "ready") return;
    const run = () => api("/api/gcal/sync", { pullOnly: true }).catch(() => {});
    const first = setTimeout(run, 3000);
    refreshPush(api);
    // 管理员打开时做例行检查（社交媒体周期、日常事务、资料调整）
    if (isAdmin) api("/api/maintenance").catch(() => {});
    const iv = setInterval(run, 5 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [state, api, isAdmin]);

  if (isLogin) return <>{children}</>;
  if (state !== "ready" || !member) return <FullScreenMessage>{t("common.loading")}</FullScreenMessage>;

  const items = NAV.filter((n) => !n.admin || isAdmin);
  // 手机底部最多 5 个：不放「员工」，确保「设置」（开启通知）一定在
  const mobileItems = items.filter((n) => n.href !== "/team");

  return (
    <div className="min-h-screen md:flex">
      <nav
        aria-label="Main"
        className="hidden md:flex md:w-[232px] md:flex-none bg-nav text-[#C9CAD0] px-4 py-7 box-border flex-col gap-7 md:sticky md:top-0 md:h-screen"
      >
        <div className="px-3 flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-on-dark.png" alt="ABOUND CREATION" className="h-[38px] w-auto self-start" />
          <div className="text-[12px] text-[#A3A5AC] mt-1.5">{t("app.sub")}</div>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 min-h-11 px-3 rounded-[10px] no-underline text-[15px]",
                  active ? "bg-[#2C2E33] text-white font-medium" : "text-[#C9CAD0] hover:text-white hover:bg-[#222327]"
                )}
              >
                <Icon name={n.icon} />
                {t(n.key)}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#222327]">
            <Avatar name={member.name} email={member.email} size={36} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[14px] text-white truncate">{member.name}</span>
              <span className="text-[12px] text-[#A3A5AC]">{t(`role.${member.role}`)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-3 min-h-11 px-3 rounded-[10px] text-[14px] text-[#C9CAD0] hover:text-white hover:bg-[#222327] cursor-pointer"
          >
            <Icon name="logout" />
            {t("nav.signOut")}
          </button>
        </div>
      </nav>

      <div className="flex-1 min-w-0 pb-[84px] md:pb-0">
        <div className="md:hidden bg-nav text-white px-4 py-3 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-on-dark.png" alt="ABOUND CREATION" className="h-[28px] w-auto" />
          <button type="button" onClick={() => signOut()} aria-label={t("nav.signOut")} className="w-11 h-11 flex items-center justify-center text-[#C9CAD0] cursor-pointer">
            <Icon name="logout" />
          </button>
        </div>
        <main className="px-4 sm:px-6 lg:px-10 pt-6 pb-12 flex flex-col gap-6 max-w-[1600px]">
          {loaded ? children : <div className="text-[14px] text-muted py-10">{t("common.loading")}</div>}
        </main>
      </div>

      <nav
        aria-label="Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 grid bg-white border-t border-line px-2 pt-1.5 pb-4"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
      >
        {mobileItems.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "min-h-[52px] flex flex-col items-center justify-center gap-1 no-underline text-[11px]",
                active ? "text-accent font-bold" : "text-muted"
              )}
            >
              <Icon name={n.icon} size={20} />
              {t(n.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
