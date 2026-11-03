"use client";

import { useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, Icon } from "./ui";
import { exportBackup, readBackup, restoreBackup } from "@/lib/backup";
import { downloadFiles } from "@/lib/pdf";
import { formatDateTime } from "@/lib/dates";

export function BackupCard() {
  const { t, lang, member } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = member?.lastBackupAt;
  const stale = !last || Date.now() - last > 30 * 86400000;

  const doExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { file, counts } = await exportBackup(member!.email);
      await downloadFiles([file]);
      setMsg({ text: t("backup.done", { p: counts.projects, t: counts.tasks, o: counts.orderForms }), ok: true });
    } catch (e) {
      console.error(e);
      setMsg({ text: t("err.generic") });
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (f: File) => {
    setMsg(null);
    let data;
    try {
      data = await readBackup(f);
    } catch {
      setMsg({ text: t("backup.badFile") });
      return;
    }
    const when = formatDateTime(data.exportedAt, lang);
    if (!confirm(t("backup.restoreConfirm", { time: when }))) return;
    setBusy(true);
    try {
      const n = await restoreBackup(data, (d, total) => setMsg({ text: t("backup.restoring", { d, total }) }));
      setMsg({ text: t("backup.restored", { n, time: when }), ok: true });
    } catch (e) {
      console.error(e);
      setMsg({ text: t("err.generic") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 max-w-[720px]">
      <h2 id="backup" className="m-0 text-[15px] font-bold scroll-mt-6">
        {t("backup.title")}
      </h2>
      <p className="m-0 text-[14px] text-muted leading-relaxed">{t("backup.desc")}</p>
      <span className={`text-[14px] ${stale ? "text-[#8A5A00] font-medium" : "text-ok"}`}>
        ● {last ? t("backup.last", { time: formatDateTime(last, lang) }) : t("backup.never")}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={doExport} disabled={busy}>
          <Icon name="download" size={16} />
          {t("backup.export")}
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {t("backup.restore")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) doRestore(f);
          }}
        />
      </div>
      {msg && <p className={`m-0 text-[13px] ${msg.ok ? "text-ok" : "text-ink-2"}`}>{msg.text}</p>}
      <p className="m-0 text-[12px] text-faint">{t("backup.tip")}</p>
    </Card>
  );
}
