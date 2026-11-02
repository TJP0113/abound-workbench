"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { SERVICE_COLORS } from "@/lib/services";
import type { ServiceType } from "@/lib/types";
import { dueTone, daysBetween, formatDate, todayStr } from "@/lib/dates";
import { useAuth } from "./AuthProvider";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap";
  const sizes = { sm: "min-h-[36px] px-3 text-[13px]", md: "min-h-[44px] px-4 text-[14px]" };
  const variants: Record<BtnVariant, string> = {
    primary: "bg-accent text-white hover:bg-accent-dark",
    dark: "bg-ink text-white hover:bg-black",
    secondary: "bg-white text-ink border border-[#DCDCD6] hover:bg-well",
    ghost: "bg-transparent text-ink-2 hover:bg-black/5",
    danger: "bg-white text-danger border border-[#DCDCD6] hover:bg-danger-soft",
  };
  return <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("bg-card border border-line rounded-[14px] p-5", className)}>{children}</div>;
}

export function ServiceTag({ type, variant, label }: { type: ServiceType; variant?: string; label?: string }) {
  const { t } = useAuth();
  const [bg, fg] = SERVICE_COLORS[type];
  return (
    <span
      className="inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {t(`svc.${type}`)}
      {type === "uniform" && variant ? ` · ${t(`variant.${variant}`)}` : ""}
      {type === "other" && label ? ` · ${label}` : ""}
    </span>
  );
}

export function Pill({ children, bg, fg, round }: { children: ReactNode; bg: string; fg: string; round?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center h-6 px-2.5 text-[12px] font-medium whitespace-nowrap",
        round ? "rounded-full" : "rounded-md"
      )}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export const PROJECT_STATUS_COLORS: Record<string, [string, string]> = {
  active: ["#E9ECFB", "#2D45C8"],
  waiting: ["#FBF1DC", "#8A5A00"],
  paused: ["#EDEDEA", "#4A4C51"],
  done: ["#E3F2E8", "#23683F"],
  cancelled: ["#EDEDEA", "#5F6166"],
};

export const TASK_STATUS_COLORS: Record<string, [string, string, string]> = {
  todo: ["#EDEDEA", "#4A4C51", "#9A9CA3"],
  doing: ["#E9ECFB", "#2D45C8", "#2D45C8"],
  review: ["#FBF1DC", "#8A5A00", "#C98A12"],
  revise: ["#FCE8E8", "#A82828", "#C42B2B"],
  done: ["#E3F2E8", "#23683F", "#2F7D4F"],
};

export const PRIORITY_COLORS: Record<string, string> = { high: "#A82828", medium: "#8A5A00", low: "#5F6166" };

export function ProgressBar({ pct, color = "#18191B" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-[#EEEEEA] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

const AVATAR_COLORS = ["#2D45C8", "#8A4310", "#1F6B5C", "#5B3A9E", "#8E2A63", "#3F4146"];

export function Avatar({ name, email, size = 28 }: { name: string; email: string; size?: number }) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full text-white font-semibold flex-none"
      style={{ width: size, height: size, background: AVATAR_COLORS[h % AVATAR_COLORS.length], fontSize: size * 0.38, fontFamily: "var(--font-display)" }}
    >
      {initials || "?"}
    </span>
  );
}

/** 截止日显示：今天 / 明天 / 逾期 N 天 / 日期，并按规则上色 */
export function DueLabel({ date, done, className }: { date?: string; done?: boolean; className?: string }) {
  const { t, lang } = useAuth();
  if (!date) return <span className={className}>—</span>;
  const today = todayStr();
  const left = daysBetween(today, date);
  const tone = done ? "none" : dueTone(date, today);
  let label = formatDate(date, lang);
  if (!done) {
    if (left < 0) label = t("common.overdueDays", { n: -left });
    else if (left === 0) label = t("common.today");
    else if (left === 1) label = `${label} · ${t("common.tomorrow")}`;
    else if (left <= 7) label = `${label} · ${t("common.daysLeft", { n: left })}`;
  }
  const color = tone === "red" ? "#A82828" : tone === "amber" ? "#8A5A00" : undefined;
  return (
    <span className={cx("whitespace-nowrap", tone !== "none" && "font-bold", className)} style={color ? { color } : undefined}>
      {label}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx(
        "m-auto p-0 rounded-[16px] border border-line bg-white text-ink backdrop:bg-black/40 w-[calc(100%-32px)] max-h-[calc(100vh-48px)]",
        wide ? "max-w-[860px]" : "max-w-[560px]"
      )}
    >
      {open && (
        <div className="flex flex-col max-h-[calc(100vh-48px)]">
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
            <h2 className="m-0 text-[18px] font-bold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:bg-black/5 cursor-pointer"
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="px-6 pb-4 overflow-y-auto flex flex-col gap-4">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-line-soft flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-medium text-ink-2">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-faint py-6 text-center">{children}</div>;
}

const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  check: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  sync: <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

export function Icon({ name, size = 18 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 p-[3px] rounded-[10px] bg-[#E9E9E4]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-[36px] px-3.5 rounded-[7px] text-[13px] cursor-pointer",
            o.value === value ? "bg-white text-ink font-medium shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-[#4A4C51]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[26px] sm:text-[28px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="m-0 text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
