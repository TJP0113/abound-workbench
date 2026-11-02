"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { Button, Field, Modal, ServiceTag, cx } from "./ui";
import { useActions } from "@/lib/actions";
import { SERVICE_TYPES, defaultStages, newService } from "@/lib/services";
import { addDays, monthStr, todayStr } from "@/lib/dates";
import type { Project, ProjectService, ProjectStatus, ServiceType, UniformVariant } from "@/lib/types";

const STATUSES: ProjectStatus[] = ["active", "waiting", "paused", "done", "cancelled"];

function StageEditor({ svc, onChange }: { svc: ProjectService; onChange: (s: ProjectService) => void }) {
  const { t, stage } = useAuth();
  const [draft, setDraft] = useState("");
  const set = (stages: string[]) => onChange({ ...svc, stages, current: Math.min(svc.current, stages.length) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= svc.stages.length) return;
    const s = [...svc.stages];
    [s[i], s[j]] = [s[j], s[i]];
    set(s);
  };
  return (
    <div className="flex flex-col gap-2">
      <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
        {svc.stages.map((s, i) => (
          <li key={`${s}-${i}`} className="flex items-center gap-2 text-[13px]">
            <span className="w-6 text-faint text-right" style={{ fontFamily: "var(--font-display)" }}>
              {i + 1}
            </span>
            <input
              className="field !min-h-[36px] !py-1"
              aria-label={t("proj.stageName")}
              value={stage(s)}
              onChange={(e) => {
                const next = [...svc.stages];
                next[i] = e.target.value;
                set(next);
              }}
            />
            <button type="button" aria-label="↑" onClick={() => move(i, -1)} className="w-9 h-9 rounded-lg hover:bg-black/5 cursor-pointer text-muted">
              ↑
            </button>
            <button type="button" aria-label="↓" onClick={() => move(i, 1)} className="w-9 h-9 rounded-lg hover:bg-black/5 cursor-pointer text-muted">
              ↓
            </button>
            <button
              type="button"
              aria-label={t("common.delete")}
              onClick={() => set(svc.stages.filter((_, j) => j !== i))}
              className="w-9 h-9 rounded-lg hover:bg-danger-soft cursor-pointer text-danger"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <input className="field !min-h-[36px]" placeholder={t("proj.stageName")} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button
          size="sm"
          onClick={() => {
            if (!draft.trim()) return;
            set([...svc.stages, draft.trim()]);
            setDraft("");
          }}
        >
          {t("proj.addStage")}
        </Button>
      </div>
    </div>
  );
}

export function ProjectForm({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const { t, member } = useAuth();
  const { members } = useData();
  const { createProject, updateProject } = useActions();
  const router = useRouter();
  const today = todayStr();
  const active = members.filter((m) => m.active);

  const [f, setF] = useState<Omit<Project, "id">>(() =>
    project
      ? { ...project }
      : {
          name: "",
          client: "",
          startDate: today,
          dueDate: addDays(today, 14),
          ownerEmail: member?.email ?? "",
          memberEmails: member ? [member.email] : [],
          status: "active",
          services: [newService("brand")],
          notes: "",
        }
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openStages, setOpenStages] = useState<number | null>(null);

  const up = (patch: Partial<Project>) => setF((o) => ({ ...o, ...patch }));
  const setSvc = (i: number, s: ProjectService) => up({ services: f.services.map((x, j) => (j === i ? s : x)) });

  const changeType = (i: number, type: ServiceType, variant?: UniformVariant) => {
    const s = newService(type, variant);
    if (type === "social") s.social = { startMonth: monthStr(), endMonth: null, posts: 12, videos: 4, cycles: [] };
    setSvc(i, s);
    if (type === "other") setOpenStages(i);
  };

  const save = async () => {
    if (!f.name.trim() || !f.dueDate || !f.ownerEmail || !f.services.length) {
      setError(t("common.required"));
      return;
    }
    setBusy(true);
    setError("");
    const memberEmails = Array.from(new Set([f.ownerEmail, ...f.memberEmails]));
    const data = { ...f, name: f.name.trim(), client: f.client.trim(), memberEmails };
    try {
      if (project) {
        await updateProject(project.id, data, project);
        onClose();
      } else {
        const id = await createProject(data);
        onClose();
        router.push(`/projects/${id}`);
      }
    } catch (e) {
      console.error(e);
      setError(t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={project ? t("proj.edit") : t("proj.new")}
      footer={
        <>
          {error && <span className="mr-auto self-center text-[13px] text-danger">{error}</span>}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("proj.name")} required>
          <input className="field" value={f.name} onChange={(e) => up({ name: e.target.value })} />
        </Field>
        <Field label={t("proj.client")}>
          <input className="field" value={f.client} onChange={(e) => up({ client: e.target.value })} />
        </Field>
        <Field label={t("proj.start")}>
          <input type="date" className="field" value={f.startDate} onChange={(e) => up({ startDate: e.target.value })} />
        </Field>
        <Field label={t("proj.due")} required>
          <input type="date" className="field" value={f.dueDate} onChange={(e) => up({ dueDate: e.target.value })} />
        </Field>
        <Field label={t("proj.status")}>
          <select className="field" value={f.status} onChange={(e) => up({ status: e.target.value as ProjectStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("proj.owner")} required>
          <select className="field" value={f.ownerEmail} onChange={(e) => up({ ownerEmail: e.target.value })}>
            {active.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-1.5">
          <legend className="text-[13px] font-medium text-ink-2 mb-1.5">{t("proj.members")}</legend>
          <div className="flex flex-wrap gap-2">
            {active.map((m) => {
              const on = f.memberEmails.includes(m.email) || f.ownerEmail === m.email;
              return (
                <label
                  key={m.email}
                  className={cx(
                    "flex items-center gap-2 min-h-[36px] px-3 rounded-lg border text-[13px] cursor-pointer",
                    on ? "border-ink bg-ink text-white" : "border-[#DCDCD6] bg-white"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={f.ownerEmail === m.email}
                    onChange={(e) =>
                      up({ memberEmails: e.target.checked ? [...f.memberEmails, m.email] : f.memberEmails.filter((x) => x !== m.email) })
                    }
                  />
                  {m.name}
                </label>
              );
            })}
          </div>
          <span className="text-[12px] text-faint">{t("proj.membersHint")}</span>
        </fieldset>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold">{t("proj.services")}</span>
          <Button size="sm" onClick={() => up({ services: [...f.services, newService("graphic")] })}>
            {t("proj.addService")}
          </Button>
        </div>
        {f.services.map((s, i) => (
          <div key={i} className="border border-line rounded-[12px] p-4 flex flex-col gap-3 bg-well">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t("proj.services")}>
                <select className="field" value={s.type} onChange={(e) => changeType(i, e.target.value as ServiceType)}>
                  {SERVICE_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {t(`svc.${x}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {s.type === "uniform" && (
                <Field label={t("proj.variant")}>
                  <select className="field" value={s.variant} onChange={(e) => changeType(i, "uniform", e.target.value as UniformVariant)}>
                    <option value="readymade">{t("variant.readymade")}</option>
                    <option value="custom">{t("variant.custom")}</option>
                  </select>
                </Field>
              )}
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="ghost" onClick={() => setOpenStages(openStages === i ? null : i)}>
                  {t("proj.stages")} ({s.stages.length})
                </Button>
                {f.services.length > 1 && (
                  <Button size="sm" variant="danger" onClick={() => up({ services: f.services.filter((_, j) => j !== i) })}>
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <ServiceTag type={s.type} variant={s.variant} label={s.label} />
              {s.stages.join() !== defaultStages(s.type, s.variant).join() && (
                <span className="text-[12px] text-faint">✎</span>
              )}
            </div>
            {s.type === "other" && (
              <Field label={t("proj.otherLabel")} hint={t("proj.otherHint")}>
                <input className="field" value={s.label ?? ""} placeholder={t("proj.otherPlaceholder")} onChange={(e) => setSvc(i, { ...s, label: e.target.value })} />
              </Field>
            )}
            {openStages === i && <StageEditor svc={s} onChange={(x) => setSvc(i, x)} />}
            {s.type === "social" && s.social && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label={t("social.start")}>
                  <input
                    type="month"
                    className="field"
                    value={s.social.startMonth}
                    onChange={(e) => setSvc(i, { ...s, social: { ...s.social!, startMonth: e.target.value } })}
                  />
                </Field>
                <Field label={t("social.end")} hint={s.social.endMonth ? undefined : t("social.ongoing")}>
                  <input
                    type="month"
                    className="field"
                    value={s.social.endMonth ?? ""}
                    onChange={(e) => setSvc(i, { ...s, social: { ...s.social!, endMonth: e.target.value || null } })}
                  />
                </Field>
                <Field label={t("social.posts")}>
                  <input
                    type="number"
                    min={0}
                    className="field"
                    value={s.social.posts}
                    onChange={(e) => setSvc(i, { ...s, social: { ...s.social!, posts: Math.max(0, Number(e.target.value) || 0) } })}
                  />
                </Field>
                <Field label={t("social.videos")}>
                  <input
                    type="number"
                    min={0}
                    className="field"
                    value={s.social.videos}
                    onChange={(e) => setSvc(i, { ...s, social: { ...s.social!, videos: Math.max(0, Number(e.target.value) || 0) } })}
                  />
                </Field>
              </div>
            )}
          </div>
        ))}
      </div>

      <Field label={t("proj.notes")} hint={t("proj.notesHint")}>
        <textarea className="field" value={f.notes ?? ""} onChange={(e) => up({ notes: e.target.value })} />
      </Field>
    </Modal>
  );
}
