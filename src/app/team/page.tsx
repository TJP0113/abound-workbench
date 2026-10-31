"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { TopBar } from "@/components/AppShell";
import { Avatar, Button, Card, Field, Icon, Modal, PageHeader, Pill } from "@/components/ui";
import { useActions } from "@/lib/actions";
import type { Member, Role } from "@/lib/types";

function MemberForm({ open, onClose, member }: { open: boolean; onClose: () => void; member?: Member }) {
  const { t } = useAuth();
  const { members } = useData();
  const { saveMember } = useActions();
  const [f, setF] = useState<Member>(
    member ?? { email: "", name: "", role: "staff", active: true, title: "", skills: "", phone: "" }
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<Member>) => setF((o) => ({ ...o, ...p }));

  const save = async () => {
    const email = f.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !f.name.trim()) {
      setError(t("common.required"));
      return;
    }
    const admins = members.filter((m) => m.role === "admin" && m.active && m.email !== email);
    if (member?.role === "admin" && (f.role !== "admin" || !f.active) && admins.length === 0) {
      setError(t("team.lastAdmin"));
      return;
    }
    setBusy(true);
    try {
      await saveMember({ ...f, email, name: f.name.trim() });
      onClose();
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
      title={member ? t("team.edit") : t("team.add")}
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
      <Field label={t("team.email")} hint={t("team.emailHint")} required>
        <input className="field" type="email" disabled={!!member} value={f.email} onChange={(e) => up({ email: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("team.name")} required>
          <input className="field" value={f.name} onChange={(e) => up({ name: e.target.value })} />
        </Field>
        <Field label={t("team.role")}>
          <select className="field" value={f.role} onChange={(e) => up({ role: e.target.value as Role })}>
            <option value="staff">{t("role.staff")}</option>
            <option value="admin">{t("role.admin")}</option>
          </select>
        </Field>
        <Field label={t("team.titleField")}>
          <input className="field" value={f.title ?? ""} onChange={(e) => up({ title: e.target.value })} />
        </Field>
        <Field label={t("team.phone")}>
          <input className="field" value={f.phone ?? ""} onChange={(e) => up({ phone: e.target.value })} />
        </Field>
      </div>
      <Field label={t("team.skills")}>
        <input className="field" value={f.skills ?? ""} onChange={(e) => up({ skills: e.target.value })} />
      </Field>
      {member && (
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" className="w-5 h-5 accent-[#2D45C8]" checked={f.active} onChange={(e) => up({ active: e.target.checked })} />
          {t("team.active")}
        </label>
      )}
    </Modal>
  );
}

export default function TeamPage() {
  const { t, isAdmin, member: me } = useAuth();
  const { members, tasks } = useData();
  const [form, setForm] = useState<{ member?: Member } | null>(null);

  if (!isAdmin) return <Card>{t("err.permission")}</Card>;

  return (
    <>
      <PageHeader
        title={t("team.title")}
        actions={
          <>
            <TopBar />
            <Button variant="primary" onClick={() => setForm({})}>
              <Icon name="plus" size={16} />
              {t("team.add")}
            </Button>
          </>
        }
      />
      <div className="bg-card border border-line rounded-[14px] overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-muted text-[12px]">
              {["team.name", "team.email", "team.role", "team.titleField", "team.skills", "team.openTasks", ""].map((k, i) => (
                <th key={i} scope="col" className="px-4 py-3.5 font-medium border-b border-[#EAEAE5]">
                  {k ? t(k) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.email} className={m.active ? "" : "opacity-60"}>
                <td className="px-4 py-3 border-b border-[#F0F0EC]">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} email={m.email} size={32} />
                    <span className="font-medium">
                      {m.name}
                      {m.email === me?.email && <span className="text-faint font-normal">{t("team.self")}</span>}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-[#F0F0EC] text-ink-2">{m.email}</td>
                <td className="px-4 py-3 border-b border-[#F0F0EC]">
                  {m.active ? (
                    <Pill bg={m.role === "admin" ? "#E9ECFB" : "#EDEDEA"} fg={m.role === "admin" ? "#2D45C8" : "#3A3C40"}>
                      {t(`role.${m.role}`)}
                    </Pill>
                  ) : (
                    <Pill bg="#EDEDEA" fg="#5F6166">
                      {t("team.inactive")}
                    </Pill>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-[#F0F0EC] text-ink-2">{m.title || "—"}</td>
                <td className="px-4 py-3 border-b border-[#F0F0EC] text-ink-2">{m.skills || "—"}</td>
                <td className="px-4 py-3 border-b border-[#F0F0EC] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {tasks.filter((x) => x.status !== "done" && x.assigneeEmails.includes(m.email)).length}
                </td>
                <td className="px-4 py-3 border-b border-[#F0F0EC] text-right">
                  <Button size="sm" onClick={() => setForm({ member: m })}>
                    {t("common.edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && <MemberForm open member={form.member} onClose={() => setForm(null)} />}
    </>
  );
}
