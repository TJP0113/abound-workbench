"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { ProjectForm } from "@/components/ProjectForm";
import { SwipeRow } from "@/components/SwipeRow";
import { TrashModal } from "@/components/TrashModal";
import {
  Button,
  DueLabel,
  EmptyState,
  Icon,
  PROJECT_STATUS_DOT,
  StatusDot,
  PageHeader,
  Pill,
  ProgressBar,
  Segmented,
  ServiceTag,
  cx,
} from "@/components/ui";
import { SERVICE_COLORS, SERVICE_TYPES, defaultStages } from "@/lib/services";
import { currentStage, projectProgress, socialCycleProgress } from "@/lib/project-utils";
import { addDays, daysBetween, formatDate, parseDate, todayStr } from "@/lib/dates";
import { useActions } from "@/lib/actions";
import type { Project, ProjectStatus, ServiceType, UniformVariant } from "@/lib/types";

type View = "list" | "board" | "timeline";
const STATUS_FILTERS: (ProjectStatus | "all" | "open")[] = ["open", "active", "waiting", "paused", "done", "cancelled", "all"];

const LIST_COLS = "minmax(180px,2fr) minmax(130px,1.3fr) minmax(120px,1.2fr) 160px minmax(100px,1fr) minmax(90px,.9fr) 110px";

function ListView({ projects }: { projects: Project[] }) {
  const { t, stage, isAdmin } = useAuth();
  const { tasks, memberName } = useData();
  const { deleteProject } = useActions();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!projects.length) return <EmptyState>{t("proj.empty")}</EmptyState>;

  const remove = async (p: Project) => {
    if (!confirm(`${p.name}\n\n${t("proj.deleteConfirm")}`)) return setOpenId(null);
    setOpenId(null);
    await deleteProject(p.id);
  };

  return (
    <div className="bg-card rounded-[24px] overflow-hidden text-[14px]" role="table">
      <div role="row" className="hidden xl:grid text-left text-muted text-[12px] border-b border-[#EAEAE5]" style={{ gridTemplateColumns: LIST_COLS }}>
        {["proj.name", "proj.services", "proj.stage", "proj.progress", "proj.owner", "proj.due", "proj.status"].map((k, i) => (
          <div key={k} role="columnheader" className={cx("py-3.5 font-medium", i === 0 ? "px-5" : "px-3")}>
            {t(k)}
          </div>
        ))}
      </div>
      {projects.map((p) => {
        const cur = currentStage(p);
        const pct = projectProgress(p, tasks);
        const social = socialCycleProgress(p, tasks);
        const stageText = cur?.stage ? stage(cur.stage) : cur?.svc.stages.length === 0 ? "—" : t("proj.allDone");
        const stageSub = social
          ? t("social.cycleProgress", { a: social.done, b: social.total })
          : cur && cur.svc.stages.length
            ? t("proj.stageOf", { a: Math.min(cur.index + 1, cur.svc.stages.length), b: cur.svc.stages.length })
            : "";
        const services = (
          <div className="flex flex-wrap gap-1">
            {p.services.map((s, i) => (
              <ServiceTag key={i} type={s.type} variant={s.variant} label={s.label} />
            ))}
          </div>
        );
        const progress = (
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <ProgressBar pct={pct} />
            </div>
            <span className="w-9 text-right text-[13px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {pct}%
            </span>
          </div>
        );
        const status = (
          <StatusDot dot={PROJECT_STATUS_DOT[p.status]}>{t(`status.${p.status}`)}</StatusDot>
        );
        const due = <DueLabel date={p.dueDate} done={p.status === "done" || p.status === "cancelled"} />;
        return (
          <SwipeRow
            key={p.id}
            enabled={isAdmin}
            open={openId === p.id}
            onOpenChange={(o) => setOpenId(o ? p.id : null)}
            onDelete={() => remove(p)}
            deleteLabel={t("common.delete")}
            className="border-b border-[#F0F0EC] last:border-b-0"
          >
            {/* 宽屏：表格行 */}
            <div role="row" className="hidden xl:grid items-center hover:bg-well select-none" style={{ gridTemplateColumns: LIST_COLS }}>
              <div role="cell" className="px-5 py-3.5 min-w-0">
                <Link href={`/projects/${p.id}`} className="text-ink no-underline font-medium hover:underline" draggable={false}>
                  {p.name}
                </Link>
                {p.client && <div className="text-[12px] text-muted mt-1">{p.client}</div>}
              </div>
              <div role="cell" className="px-3 py-3.5">{services}</div>
              <div role="cell" className="px-3 py-3.5 text-ink-2">
                {stageText}
                <div className="text-[12px] text-faint mt-1">{stageSub}</div>
              </div>
              <div role="cell" className="px-3 py-3.5">{progress}</div>
              <div role="cell" className="px-3 py-3.5 text-ink-2 truncate">{memberName(p.ownerEmail)}</div>
              <div role="cell" className="px-3 py-3.5">{due}</div>
              <div role="cell" className="px-3 py-3.5">{status}</div>
            </div>
            {/* 窄屏 / 手机：卡片 */}
            <div role="row" className="xl:hidden flex flex-col gap-2 px-4 py-3.5 select-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/projects/${p.id}`} className="text-ink no-underline font-medium" draggable={false}>
                    {p.name}
                  </Link>
                  {p.client && <div className="text-[12px] text-muted mt-0.5">{p.client}</div>}
                </div>
                {status}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                {services}
                <span>
                  {stageText}
                  {stageSub && ` · ${stageSub}`}
                </span>
              </div>
              {progress}
              <div className="flex justify-between text-[12px] text-ink-2">
                <span>{memberName(p.ownerEmail)}</span>
                {due}
              </div>
            </div>
          </SwipeRow>
        );
      })}
    </div>
  );
}

const BOARD_KEYS = ["brand", "uniform:readymade", "uniform:custom", "social", "merch", "graphic", "photo"] as const;

function BoardView({ projects }: { projects: Project[] }) {
  const { t, stage } = useAuth();
  const { memberName } = useData();
  const { updateProject } = useActions();
  const [key, setKey] = useState<(typeof BOARD_KEYS)[number]>("brand");
  const [dragging, setDragging] = useState<string | null>(null);
  const [type, variant] = key.split(":") as [ServiceType, UniformVariant | undefined];
  const columns = [...defaultStages(type, variant), "__done"];

  const cards = projects.flatMap((p) =>
    p.services
      .map((s, i) => ({ p, s, i }))
      .filter(({ s }) => s.type === type && (type !== "uniform" || (s.variant ?? "readymade") === variant))
  );

  const colOf = (s: Project["services"][number]) => {
    if (s.current >= s.stages.length) return "__done";
    const name = s.stages[s.current];
    if (columns.includes(name)) return name;
    // 自定义阶段：按位置放
    return columns[Math.min(s.current, columns.length - 2)];
  };

  const drop = async (col: string) => {
    if (!dragging) return;
    const [pid, idx] = dragging.split("#");
    setDragging(null);
    const p = projects.find((x) => x.id === pid);
    if (!p) return;
    const i = Number(idx);
    const s = p.services[i];
    let next: number;
    if (col === "__done") next = s.stages.length;
    else {
      const pos = s.stages.indexOf(col);
      next = pos >= 0 ? pos : columns.indexOf(col);
    }
    if (next === s.current) return;
    const services = p.services.map((x, j) => (j === i ? { ...x, current: Math.min(next, x.stages.length) } : x));
    await updateProject(p.id, { services }, p).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          {t("proj.boardPick")}
          <select className="field !w-auto" value={key} onChange={(e) => setKey(e.target.value as typeof key)}>
            {BOARD_KEYS.map((k) => {
              const [ty, va] = k.split(":");
              return (
                <option key={k} value={k}>
                  {t(`svc.${ty}`)}
                  {va ? ` · ${t(`variant.${va}`)}` : ""}
                </option>
              );
            })}
          </select>
        </label>
        <span className="text-[12px] text-faint">{t("proj.boardHint")}</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, minWidth: columns.length * 212 }}>
          {columns.map((col) => {
            const list = cards.filter(({ s }) => colOf(s) === col);
            return (
              <section
                key={col}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(col)}
                className="bg-[#E9E6E1] rounded-[20px] p-2.5 flex flex-col gap-2 min-h-[160px]"
              >
                <h2 className="m-0 px-1.5 py-1 text-[13px] font-bold flex justify-between">
                  <span>{col === "__done" ? t("proj.allDone") : stage(col)}</span>
                  <span className="text-[#4A4C51]" style={{ fontFamily: "var(--font-display)" }}>
                    {list.length}
                  </span>
                </h2>
                {list.map(({ p, i }) => (
                  <article
                    key={`${p.id}#${i}`}
                    draggable
                    onDragStart={() => setDragging(`${p.id}#${i}`)}
                    onDragEnd={() => setDragging(null)}
                    className="bg-white rounded-[14px] p-3 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing"
                  >
                    <Link href={`/projects/${p.id}`} className="text-[14px] font-medium text-ink no-underline hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-[12px] text-muted">{p.client}</span>
                    <div className="flex justify-between text-[12px] pt-1.5 border-t border-line-soft">
                      <span className="text-ink-2">{memberName(p.ownerEmail)}</span>
                      <DueLabel date={p.dueDate} done={p.status === "done"} />
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineView({ projects }: { projects: Project[] }) {
  const { t, lang } = useAuth();
  const today = todayStr();
  const dated = projects.filter((p) => p.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!dated.length) return <EmptyState>{t("proj.empty")}</EmptyState>;
  const minStart = dated.reduce((m, p) => ((p.startDate || p.dueDate) < m ? p.startDate || p.dueDate : m), today);
  const start = addDays(minStart < addDays(today, -14) ? minStart : addDays(today, -14), 0);
  const maxEnd = dated.reduce((m, p) => (p.dueDate > m ? p.dueDate : m), addDays(today, 30));
  const total = Math.max(daysBetween(start, maxEnd) + 7, 30);
  const pos = (d: string) => `${(daysBetween(start, d) / total) * 100}%`;
  // 每月 1 日刻度
  const ticks: string[] = [];
  const s = parseDate(start);
  for (let m = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)); daysBetween(start, m.toISOString().slice(0, 10)) < total; m.setUTCMonth(m.getUTCMonth() + 1))
    ticks.push(m.toISOString().slice(0, 10));

  return (
    <div className="bg-card rounded-[24px] overflow-x-auto">
      <div className="min-w-[900px] p-5 flex flex-col gap-1">
        <div className="relative h-6 ml-[220px] text-[12px] text-muted">
          {ticks.map((d) => (
            <span key={d} className="absolute -translate-x-1/2" style={{ left: pos(d) }}>
              {formatDate(d, lang)}
            </span>
          ))}
        </div>
        {dated.map((p) => {
          const st = p.startDate && p.startDate <= p.dueDate ? p.startDate : addDays(p.dueDate, -1);
          const color = SERVICE_COLORS[p.services[0]?.type ?? "brand"];
          return (
            <div key={p.id} className="flex items-center gap-0 h-10">
              <Link href={`/projects/${p.id}`} className="w-[220px] flex-none pr-3 text-[13px] text-ink no-underline truncate hover:underline">
                {p.name}
              </Link>
              <div className="relative flex-1 h-full border-l border-line-soft">
                {ticks.map((d) => (
                  <span key={d} aria-hidden="true" className="absolute top-0 bottom-0 border-l border-line-soft" style={{ left: pos(d) }} />
                ))}
                <span aria-hidden="true" className="absolute top-0 bottom-0 border-l-2 border-accent" style={{ left: pos(today) }} />
                <div
                  className="absolute top-2 h-6 rounded-md px-2 text-[11px] font-medium flex items-center overflow-hidden whitespace-nowrap"
                  style={{
                    left: pos(st),
                    width: `max(8px, calc(${pos(addDays(p.dueDate, 1))} - ${pos(st)}))`,
                    background: color[0],
                    color: color[1],
                    border: `1px solid ${color[1]}33`,
                  }}
                  title={`${formatDate(st, lang)} – ${formatDate(p.dueDate, lang)}`}
                >
                  {formatDate(p.dueDate, lang)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { t, isAdmin } = useAuth();
  const { projects, trash } = useData();
  const [trashOpen, setTrashOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [svc, setSvc] = useState<ServiceType | "all">("all");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) for (const s of new Set(p.services.map((x) => x.type))) c[s] = (c[s] || 0) + 1;
    return c;
  }, [projects]);

  const filtered = projects
    .filter((p) => svc === "all" || p.services.some((s) => s.type === svc))
    .filter((p) =>
      status === "all" ? true : status === "open" ? p.status === "active" || p.status === "waiting" || p.status === "paused" : p.status === status
    )
    .filter((p) => !q || `${p.name} ${p.client}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));

  const active = projects.filter((p) => p.status === "active").length;
  const waiting = projects.filter((p) => p.status === "waiting").length;

  return (
    <>
      <PageHeader
        title={t("proj.title")}
        sub={t("proj.summary", { active, waiting })}
        actions={
          <>
            <TopBar />
            {isAdmin && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} />
                {t("proj.new")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div role="group" aria-label={t("proj.services")} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={svc === "all"}
            onClick={() => setSvc("all")}
            className={cx(
              "h-9 px-4 rounded-full text-[13px] font-medium border cursor-pointer",
              svc === "all" ? "bg-brand text-white border-transparent shadow-[0_4px_10px_rgba(236,28,36,.2)]" : "bg-white border-line text-ink-2"
            )}
          >
            {t("common.all")} {projects.length}
          </button>
          {SERVICE_TYPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={svc === s}
              onClick={() => setSvc(s)}
              className={cx(
                "h-9 px-4 rounded-full text-[13px] font-medium border cursor-pointer flex items-center gap-2",
                svc === s ? "bg-brand text-white border-transparent shadow-[0_4px_10px_rgba(236,28,36,.2)]" : "bg-white border-line text-ink-2"
              )}
            >
              <span aria-hidden="true" className={cx("w-2 h-2 rounded-full", svc === s && "ring-2 ring-white")} style={{ background: SERVICE_COLORS[s][1] }} />
              {t(`svc.${s}`)} {counts[s] || 0}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input className="field !w-[200px] !rounded-full !px-4" type="search" placeholder={t("common.search")} aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 text-[13px] text-muted">
            {t("proj.status")}
            <select className="field !w-auto !rounded-full !px-4" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? t("common.all") : s === "open" ? `${t("status.active")} / ${t("status.waiting")} / ${t("status.paused")}` : t(`status.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("proj.list") },
              { value: "board", label: t("proj.board") },
              { value: "timeline", label: t("proj.timeline") },
            ]}
          />
          {isAdmin && (
            <Button onClick={() => setTrashOpen(true)}>
              <Icon name="trash" size={16} />
              {t("trash.title")}
              {trash.length > 0 && ` ${trash.length}`}
            </Button>
          )}
        </div>
      </div>

      {view === "list" && <ListView projects={filtered} />}
      {view === "board" && <BoardView projects={filtered} />}
      {view === "timeline" && <TimelineView projects={filtered} />}
      {view === "list" && filtered.length > 0 && <p className="m-0 text-[12px] text-faint">{t("proj.clickName")}
          {isAdmin && t("proj.swipeHint")}
        </p>}

      {creating && <ProjectForm open onClose={() => setCreating(false)} />}
      {isAdmin && <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />}
    </>
  );
}
