"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { EventForm } from "@/components/EventForm";
import { Button, Icon, PageHeader, Segmented, cx } from "@/components/ui";
import { EVENT_COLORS } from "@/lib/services";
import { buildCalendarItems, itemsOnDay, type CalItem } from "@/lib/calendar-items";
import { addDays, addMonths, formatDate, formatDateTime, formatMonth, monthStr, todayStr, weekStart, weekdayShort } from "@/lib/dates";
import { useGcalStatus } from "@/lib/useGcalStatus";
import type { CalEvent, EventType } from "@/lib/types";

const LEGEND: EventType[] = ["delivery", "deadline", "meeting", "internal"];

function Chip({ item, onOpen, compact }: { item: CalItem; onOpen: (i: CalItem) => void; compact?: boolean }) {
  const c = EVENT_COLORS[item.type];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      title={item.title}
      className={cx(
        "w-full text-left rounded-md px-1.5 py-1 leading-snug cursor-pointer overflow-hidden text-ellipsis",
        compact ? "text-[12px] whitespace-nowrap" : "text-[13px]"
      )}
      style={{ background: c.bg, color: c.fg, fontWeight: item.type === "delivery" ? 700 : 500 }}
    >
      {item.time && <span className="mr-1">{item.time}</span>}
      {item.title}
    </button>
  );
}

export default function CalendarPage() {
  const { t, lang, member, api } = useAuth();
  const { projects, tasks, events } = useData();
  const router = useRouter();
  const gcal = useGcalStatus();
  const today = todayStr();
  const [view, setView] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(monthStr());
  const [week, setWeek] = useState(weekStart(today));
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [form, setForm] = useState<{ event?: CalEvent; date?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const items = useMemo(() => {
    const all = buildCalendarItems(projects, tasks, events, lang);
    if (scope === "all" || !member) return all;
    return all.filter((i) => i.people.includes(member.email));
  }, [projects, tasks, events, lang, scope, member]);

  const open = (i: CalItem) => {
    if (i.event) setForm({ event: i.event });
    else if (i.link) router.push(i.link);
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await api("/api/gcal/sync");
    } catch {
      /* 状态栏会显示 */
    } finally {
      setSyncing(false);
    }
  };

  const first = weekStart(`${month}-01`);
  const days = view === "month" ? Array.from({ length: 42 }, (_, i) => addDays(first, i)) : Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const weekdays = t("weekday.short").split(",");

  const title =
    view === "month" ? formatMonth(month, lang) : `${formatDate(week, lang)} – ${formatDate(addDays(week, 6), lang)}`;

  const step = (n: number) => {
    if (view === "month") setMonth(addMonths(month, n));
    else setWeek(addDays(week, 7 * n));
  };

  return (
    <>
      <PageHeader
        title={t("cal.title")}
        actions={
          <>
            <TopBar />
            <Button variant="primary" onClick={() => setForm({ date: today })}>
              <Icon name="plus" size={16} />
              {t("cal.new")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="sm" aria-label={t("cal.prev")} onClick={() => step(-1)} className="!px-2.5">
            <Icon name="left" size={16} />
          </Button>
          <span className="text-[18px] font-bold px-2 min-w-[150px] text-center">{title}</span>
          <Button size="sm" aria-label={t("cal.next")} onClick={() => step(1)} className="!px-2.5">
            <Icon name="right" size={16} />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setMonth(monthStr());
              setWeek(weekStart(today));
            }}
          >
            {t("common.today")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cx("text-[12px]", gcal?.connected ? "text-ok" : "text-faint")}>
            ● {gcal?.connected ? t("cal.synced", { time: formatDateTime(gcal.lastSync ?? undefined, lang) }) : t("cal.notSynced")}
          </span>
          {gcal?.connected && (
            <Button size="sm" variant="ghost" onClick={syncNow} disabled={syncing}>
              <Icon name="sync" size={15} />
              {syncing ? t("cal.syncing") : t("cal.syncNow")}
            </Button>
          )}
          <Segmented
            label={t("cal.title")}
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: t("cal.month") },
              { value: "week", label: t("cal.week") },
            ]}
          />
          <Segmented
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "mine", label: t("common.mine") },
              { value: "all", label: t("common.all") },
            ]}
          />
        </div>
      </div>

      <ul aria-label="Legend" className="list-none m-0 p-0 flex flex-wrap gap-4 text-[13px] text-ink-2">
        {LEGEND.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-3 h-3 rounded-[3px]" style={{ background: EVENT_COLORS[k].solid }} />
            {t(`evt.${k}`)}
          </li>
        ))}
      </ul>

      {view === "month" ? (
        <div className="overflow-x-auto bg-card border border-line rounded-[14px]">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-7 border-b border-[#EAEAE5]">
              {weekdays.map((w) => (
                <div key={w} className="px-3 py-3 text-[12px] font-medium text-muted">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const inMonth = d.startsWith(month);
                const list = itemsOnDay(items, d);
                const isToday = d === today;
                const weekend = i % 7 >= 5;
                return (
                  <div
                    key={d}
                    onClick={() => setForm({ date: d })}
                    className={cx(
                      "min-h-[124px] p-2 box-border flex flex-col gap-1 cursor-pointer hover:bg-[#F7F8FD]",
                      i % 7 !== 6 && "border-r border-line-soft",
                      i < 35 && "border-b border-line-soft",
                      !inMonth ? "bg-[#F6F6F3]" : weekend ? "bg-[#FBFBF9]" : "bg-white"
                    )}
                  >
                    <span
                      className={cx(
                        "self-start min-w-[26px] h-[26px] px-1.5 box-border rounded-full inline-flex items-center justify-center text-[13px] font-semibold",
                        isToday ? "bg-accent text-white" : inMonth ? "text-ink" : "text-faint"
                      )}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {d.endsWith("-01") && lang === "zh" ? `${Number(d.slice(5, 7))}月` : ""}
                      {Number(d.slice(8))}
                    </span>
                    {list.slice(0, 4).map((it) => (
                      <Chip key={it.key + d} item={it} onOpen={open} compact />
                    ))}
                    {list.length > 4 && (
                      <button
                        type="button"
                        className="text-left text-[11px] text-muted px-1.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setView("week");
                          setWeek(weekStart(d));
                        }}
                      >
                        {t("cal.more", { n: list.length - 4 })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
          {days.map((d) => {
            const list = itemsOnDay(items, d);
            return (
              <section
                key={d}
                className={cx("bg-card border rounded-[14px] p-3 flex flex-col gap-2 min-h-[120px] md:min-h-[420px]", d === today ? "border-accent" : "border-line")}
              >
                <button type="button" onClick={() => setForm({ date: d })} className="flex items-baseline justify-between cursor-pointer text-left">
                  <span className="text-[12px] text-muted">{weekdayShort(d, lang)}</span>
                  <span className={cx("text-[18px] font-semibold", d === today && "text-accent")} style={{ fontFamily: "var(--font-display)" }}>
                    {formatDate(d, lang)}
                  </span>
                </button>
                {list.map((it) => (
                  <Chip key={it.key} item={it} onOpen={open} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <p className="m-0 text-[12px] text-faint">{t("cal.hint")}</p>

      {form && <EventForm open event={form.event} date={form.date} onClose={() => setForm(null)} />}
    </>
  );
}
