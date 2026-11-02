"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LangToggle, TopBar } from "@/components/AppShell";
import { Avatar, Button, Card, Icon, PageHeader } from "@/components/ui";
import { PushCard } from "@/components/PushCard";
import { useGcalStatus } from "@/lib/useGcalStatus";
import { formatDateTime } from "@/lib/dates";

const GCAL_MSG: Record<string, { zh: string; en: string; ok?: boolean }> = {
  ok: { zh: "已成功连接 Google Calendar。", en: "Google Calendar connected.", ok: true },
  cancelled: { zh: "已取消授权。", en: "Authorisation cancelled." },
  expired: { zh: "授权已过期，请再试一次。", en: "The request expired. Please try again." },
  error: { zh: "连接失败。请确认 Google Cloud 设定后再试。", en: "Connection failed. Check the Google Cloud setup and try again." },
};

function SettingsInner() {
  const { t, lang, isAdmin, member, api } = useAuth();
  const gcal = useGcalStatus();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const msg = GCAL_MSG[params.get("gcal") ?? ""];

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/gcal/connect");
      window.location.href = url;
    } catch (e) {
      setResult(e instanceof Error ? e.message : t("err.generic"));
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setResult("");
    try {
      const r = await api<{ created?: number; updated?: number; deleted?: number; pulled?: number; skipped?: boolean }>("/api/gcal/sync");
      setResult(r.skipped ? t("cal.syncing") : t("set.syncResult", { c: r.created ?? 0, u: r.updated ?? 0, d: r.deleted ?? 0, p: r.pulled ?? 0 }));
    } catch (e) {
      setResult(e instanceof Error ? e.message : t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm(t("common.confirmDelete"))) return;
    setBusy(true);
    try {
      await api("/api/gcal/disconnect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t("set.title")} actions={<TopBar />} />

      <Card className="flex flex-col gap-4 max-w-[720px]">
        <h2 className="m-0 text-[15px] font-bold">{t("set.profile")}</h2>
        <div className="flex items-center gap-3">
          <Avatar name={member!.name} email={member!.email} size={44} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">{member!.name}</span>
            <span className="text-[13px] text-muted">
              {member!.email} · {t(`role.${member!.role}`)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-ink-2">{t("set.lang")}</span>
          <LangToggle />
        </div>
      </Card>

      <PushCard />

      {isAdmin && (
        <Card className="flex flex-col gap-4 max-w-[720px]">
          <h2 className="m-0 text-[15px] font-bold">{t("set.gcal")}</h2>
          <p className="m-0 text-[14px] text-muted leading-relaxed">{t("set.gcalDesc")}</p>
          {msg && (
            <div className={`text-[13px] rounded-[10px] px-3 py-2.5 ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg[lang]}</div>
          )}
          <div className="flex flex-col gap-1 text-[14px]">
            <span className={gcal?.connected ? "text-ok font-medium" : "text-muted"}>
              ● {gcal?.connected ? t("set.gcalConnected", { email: gcal.email || "—" }) : t("set.gcalNotConnected")}
            </span>
            {gcal?.connected && <span className="text-[13px] text-muted">{t("set.lastSync", { time: formatDateTime(gcal.lastSync ?? undefined, lang) })}</span>}
            {gcal?.error === "invalid_grant" && (
              <span className="text-[13px] text-danger">
                {lang === "zh" ? "授权已失效，请重新连接。" : "Authorisation expired. Please reconnect."}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={connect} disabled={busy}>
              <Icon name="calendar" size={16} />
              {gcal?.connected ? t("set.reconnect") : t("set.connect")}
            </Button>
            {gcal?.connected && (
              <>
                <Button onClick={sync} disabled={busy}>
                  <Icon name="sync" size={16} />
                  {t("cal.syncNow")}
                </Button>
                <Button variant="danger" onClick={disconnect} disabled={busy}>
                  {t("set.disconnect")}
                </Button>
              </>
            )}
          </div>
          {result && <p className="m-0 text-[13px] text-ink-2">{result}</p>}
        </Card>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
