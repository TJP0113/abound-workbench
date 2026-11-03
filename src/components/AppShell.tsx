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
      className={cx("flex p-[3px] rounded-full h-11 box-border", dark ? "bg-[#2C2926]" : "border border-line bg-white")}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cx(
            "px-3.5 rounded-full text-[12.5px] font-semibold cursor-pointer",
            lang === l ? (dark ? "bg-white text-ink" : "bg-ink text-white") : dark ? "text-[#C9CAD0]" : "text-muted"
          )}
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
        className="relative w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center cursor-pointer text-ink"
      >
        <Icon name="bell" />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[52px] z-30 w-[min(360px,calc(100vw-32px))] bg-white rounded-[20px] shadow-[0_16px_40px_rgba(0,0,0,.16)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <span className="text-[14px] font-bold">{t("notif.title")}</span>
            {unread.length > 0 && (
              <button type="button" className="text-[12px] font-semibold text-accent-dark cursor-pointer" onClick={() => markRead(unread.map((n) => n.id))}>
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
                  !n.read && "bg-[#FFF6F4]"
                )}
              >
                <span aria-hidden="true" className={cx("mt-1.5 w-2 h-2 rounded-full flex-none", n.read ? "bg-transparent" : "bg-brand")} />
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
  const { state, member, isAdmin, t, lang, signOut, api } = useAuth();
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

  const lastBackup = member.lastBackupAt || 0;
  const backupDue = isAdmin && Date.now() - lastBackup > 30 * 86400000;

  return (
    <div className="min-h-screen bg-paper md:bg-frame md:p-3">
      <div className="md:flex md:gap-2.5 md:p-2.5 md:rounded-[32px] md:bg-nav md:min-h-[calc(100vh-24px)]">
        <nav
          aria-label="Main"
          className="hidden md:flex md:w-[248px] md:flex-none flex-col gap-4 px-1 pt-3.5 pb-1 md:sticky md:top-[22px] md:h-[calc(100vh-44px)] box-border"
        >
          <div className="px-3 flex flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-on-dark.png" alt="ABOUND CREATION" className="h-[32px] w-auto self-start" />
            <div className="text-[11.5px] text-[#A39D95]">{t("app.sub")}</div>
          </div>
          <div className="flex flex-col gap-0.5 p-2 rounded-[24px] bg-nav-card">
            {items.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-3 min-h-12 px-2 rounded-[16px] no-underline text-[14px] transition-colors",
                    active ? "bg-nav-item text-white font-semibold" : "text-[#C9C4BD] hover:text-white hover:bg-[#322E2B]"
                  )}
                >
                  <span className={cx("w-[34px] h-[34px] rounded-full flex items-center justify-center flex-none", active ? "bg-brand text-white" : "bg-[#34302D]")}>
                    <Icon name={n.icon} size={17} />
                  </span>
                  {t(n.key)}
                </Link>
              );
            })}
          </div>
          <div className="flex-1" />
          {backupDue && (
            <div className="bg-white rounded-[22px] p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-ink">{t("backup.title")}</span>
                <span className="text-[11.5px] leading-snug text-muted">
                  {lastBackup ? t("backup.last", { time: formatDateTime(lastBackup, lang) }) : t("backup.never")}
                </span>
              </div>
              <Link href="/settings#backup" className="h-10 rounded-full bg-well text-ink text-[13px] font-semibold no-underline flex items-center justify-center hover:bg-[#EFECE8]">
                {t("backup.export")}
              </Link>
            </div>
          )}
          <div className="flex items-center gap-2.5 p-3 rounded-[22px] bg-nav-card">
            <Avatar name={member.name} email={member.email} size={40} />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-[13.5px] text-white font-medium truncate">{member.name}</span>
              <span className="text-[11.5px] text-[#A39D95]">{t(`role.${member.role}`)}</span>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#C9C4BD] hover:text-white hover:bg-[#34302D] cursor-pointer"
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        </nav>

        <div className="flex-1 min-w-0 pb-[96px] md:pb-0 md:bg-paper md:rounded-[26px]">
          <div className="md:hidden bg-nav text-white px-4 py-3 flex items-center justify-between rounded-b-[24px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-on-dark.png" alt="ABOUND CREATION" className="h-[28px] w-auto" />
            <button type="button" onClick={() => signOut()} aria-label={t("nav.signOut")} className="w-11 h-11 rounded-full flex items-center justify-center text-[#C9C4BD] cursor-pointer">
              <Icon name="logout" />
            </button>
          </div>
          <main className="px-4 sm:px-6 lg:px-7 pt-5 pb-10 flex flex-col gap-5 max-w-[1600px]">
            {loaded ? children : <div className="text-[14px] text-muted py-10">{t("common.loading")}</div>}
          </main>
        </div>
      </div>

      <nav
        aria-label="Mobile"
        className="md:hidden fixed bottom-3 inset-x-3 z-20 grid bg-nav rounded-[26px] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,.25)]"
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
                "min-h-[54px] rounded-[20px] flex flex-col items-center justify-center gap-1 no-underline text-[10.5px] font-medium",
                active ? "bg-brand text-white" : "text-[#A39D95] hover:text-white"
              )}
            >
              <Icon name={n.icon} size={19} />
              {t(n.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
