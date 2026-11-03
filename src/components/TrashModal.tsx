"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { Button, EmptyState, Modal } from "./ui";
import { useActions } from "@/lib/actions";
import { formatDate, todayStr } from "@/lib/dates";

const KEEP_DAYS = 30;

export function TrashModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useAuth();
  const { trash, memberName } = useData();
  const { restoreProject, purgeProject } = useActions();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("trash.title")}>
      <p className="m-0 text-[13px] text-muted">{t("trash.hint", { n: KEEP_DAYS })}</p>
      {trash.length === 0 && <EmptyState>{t("trash.empty")}</EmptyState>}
      <ul className="m-0 p-0 list-none flex flex-col">
        {trash.map((p) => {
          const left = Math.max(0, KEEP_DAYS - Math.floor((Date.now() - (p.deletedAt || 0)) / 86400000));
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-line-soft last:border-b-0">
              <div className="flex-1 min-w-[180px]">
                <div className="text-[14px] font-medium">{p.name}</div>
                <div className="text-[12px] text-muted mt-0.5">
                  {[p.client, t("trash.deletedOn", { date: formatDate(todayStr(new Date(p.deletedAt || 0)), lang) }), p.deletedBy && memberName(p.deletedBy)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="text-[12px] text-[#8A5A00] mt-0.5">{t("trash.daysLeft", { n: left })}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === p.id} onClick={() => run(p.id, () => restoreProject(p.id))}>
                  {t("trash.restore")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === p.id}
                  onClick={() => {
                    if (!confirm(`${p.name}\n\n${t("trash.purgeConfirm")}`)) return;
                    run(p.id, () => purgeProject(p.id));
                  }}
                >
                  {t("trash.purge")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
