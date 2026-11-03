"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Button, Field, Modal } from "./ui";
import { useActions } from "@/lib/actions";
import type { Project } from "@/lib/types";

export function DuplicateProject({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useAuth();
  const { duplicateProject } = useActions();
  const router = useRouter();
  const [name, setName] = useState(`${project.name}${t("dup.suffix")}`);
  const [withForms, setWithForms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const id = await duplicateProject(project, name.trim(), withForms);
      onClose();
      router.push(`/projects/${id}`);
    } catch (e) {
      console.error(e);
      setErr(t("err.generic"));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("dup.title")}
      footer={
        <>
          {err && <span className="mr-auto self-center text-[13px] text-danger">{err}</span>}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={go}>
            {busy ? t("dup.working") : t("dup.confirm")}
          </Button>
        </>
      }
    >
      <Field label={t("proj.name")} required>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
        <input type="checkbox" className="w-4 h-4" checked={withForms} onChange={(e) => setWithForms(e.target.checked)} />
        {t("dup.withForms")}
      </label>
      <p className="m-0 text-[12px] text-muted">{t("dup.hint")}</p>
    </Modal>
  );
}
