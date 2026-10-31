"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { Button, Field, Modal, cx } from "./ui";
import { useActions } from "@/lib/actions";
import type { CalEvent, EventType } from "@/lib/types";
import { todayStr } from "@/lib/dates";

const TYPES: EventType[] = ["meeting", "internal", "delivery", "deadline"];

export function EventForm({ open, onClose, event, date }: { open: boolean; onClose: () => void; event?: CalEvent; date?: string }) {
  const { t, isAdmin, member } = useAuth();
  const { members, projects } = useData();
  const { saveEvent, deleteEvent } = useActions();
  const canEdit = !event || isAdmin || event.createdBy === member?.email;
  const [f, setF] = useState<Omit<CalEvent, "id">>(() =>
    event
      ? { ...event, attendeeEmails: event.attendeeEmails ?? [] }
      : {
          title: "",
          type: "meeting",
          date: date ?? todayStr(),
          allDay: false,
          startTime: "10:00",
          endTime: "11:00",
          attendeeEmails: member ? [member.email] : [],
        }
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<CalEvent>) => setF((o) => ({ ...o, ...p }));

  const save = async () => {
    if (!f.title.trim() || !f.date) {
      setError(t("common.required"));
      return;
    }
    if (!f.allDay && f.startTime && f.endTime && f.endTime < f.startTime && (!f.endDate || f.endDate === f.date)) {
      up({ endTime: f.startTime });
      return;
    }
    setBusy(true);
    try {
      const data: Omit<CalEvent, "id"> = {
        ...f,
        title: f.title.trim(),
        endDate: f.endDate && f.endDate > f.date ? f.endDate : undefined,
        startTime: f.allDay ? undefined : f.startTime,
        endTime: f.allDay ? undefined : f.endTime,
      };
      // 去掉不能改的栏位
      delete (data as Partial<CalEvent>).id;
      await saveEvent(data, event?.id);
      onClose();
    } catch (e) {
      console.error(e);
      setError(t("err.permission"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? t("cal.edit") : t("cal.new")}
      footer={
        <>
          {error && <span className="mr-auto self-center text-[13px] text-danger">{error}</span>}
          {event && canEdit && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!confirm(t("common.confirmDelete"))) return;
                await deleteEvent(event.id);
                onClose();
              }}
            >
              {t("common.delete")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          {canEdit && (
            <Button variant="primary" onClick={save} disabled={busy}>
              {t("common.save")}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={!canEdit} className="m-0 p-0 border-0 flex flex-col gap-4">
        <Field label={t("cal.eventTitle")} required>
          <input className="field" value={f.title} onChange={(e) => up({ title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("cal.type")}>
            <select className="field" value={f.type} onChange={(e) => up({ type: e.target.value as EventType })}>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`evt.${x}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("cal.project")}>
            <select className="field" value={f.projectId ?? ""} onChange={(e) => up({ projectId: e.target.value || undefined })}>
              <option value="">{t("cal.noProject")}</option>
              {projects
                .filter((p) => p.status !== "cancelled")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("cal.date")} required>
            <input type="date" className="field" value={f.date} onChange={(e) => up({ date: e.target.value })} />
          </Field>
          <Field label={t("cal.endDate")}>
            <input type="date" className="field" value={f.endDate ?? ""} min={f.date} onChange={(e) => up({ endDate: e.target.value || undefined })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" className="w-5 h-5 accent-[#2D45C8]" checked={f.allDay} onChange={(e) => up({ allDay: e.target.checked })} />
          {t("cal.allDay")}
        </label>
        {!f.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cal.startTime")}>
              <input type="time" className="field" value={f.startTime ?? ""} onChange={(e) => up({ startTime: e.target.value })} />
            </Field>
            <Field label={t("cal.endTime")}>
              <input type="time" className="field" value={f.endTime ?? ""} onChange={(e) => up({ endTime: e.target.value })} />
            </Field>
          </div>
        )}
        <Field label={t("cal.location")}>
          <input className="field" value={f.location ?? ""} onChange={(e) => up({ location: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink-2">{t("cal.attendees")}</span>
          <div className="flex flex-wrap gap-2">
            {members
              .filter((m) => m.active)
              .map((m) => {
                const on = f.attendeeEmails.includes(m.email);
                return (
                  <label
                    key={m.email}
                    className={cx(
                      "flex items-center min-h-[38px] px-3 rounded-lg border text-[13px] cursor-pointer",
                      on ? "border-ink bg-ink text-white" : "border-[#DCDCD6] bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        up({ attendeeEmails: e.target.checked ? [...f.attendeeEmails, m.email] : f.attendeeEmails.filter((x) => x !== m.email) })
                      }
                    />
                    {m.name}
                  </label>
                );
              })}
          </div>
        </div>
      </fieldset>
    </Modal>
  );
}
