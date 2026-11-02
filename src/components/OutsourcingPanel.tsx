"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, Field, cx } from "./ui";
import { useActions } from "@/lib/actions";
import { DEFAULT_SIZES, SHIPPING_OPTIONS } from "@/lib/services";
import type { OrderLine, Outsourcing, Project } from "@/lib/types";

/** 制服定制：外包记录（厂商、印刷厂、送货安排、尺码数量表） */
export function OutsourcingPanel({ project }: { project: Project }) {
  const { t } = useAuth();
  const { updateProject } = useActions();
  const [o, setO] = useState<Outsourcing>(() => ({
    sizeColumns: DEFAULT_SIZES,
    lines: [],
    ...(project.outsourcing ?? {}),
  }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const sizes = o.sizeColumns ?? DEFAULT_SIZES;
  const lines = o.lines ?? [];

  const up = (p: Partial<Outsourcing>) => {
    setO((x) => ({ ...x, ...p }));
    setDirty(true);
    setSaved(false);
  };
  const setLine = (i: number, l: OrderLine) => up({ lines: lines.map((x, j) => (j === i ? l : x)) });

  const save = async () => {
    setBusy(true);
    try {
      await updateProject(project.id, { outsourcing: o }, project);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      console.error(e);
      alert(t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const lineTotal = (l: OrderLine) => sizes.reduce((a, s) => a + (Number(l.sizes?.[s]) || 0), 0);
  const grand = lines.reduce((a, l) => a + lineTotal(l), 0);

  const text = (key: keyof Outsourcing, label: string, type = "text", hint?: string) => (
    <Field label={label} hint={hint}>
      <input type={type} className="field" value={(o[key] as string) ?? ""} onChange={(e) => up({ [key]: e.target.value } as Partial<Outsourcing>)} />
    </Field>
  );

  return (
    <Card className="flex flex-col gap-5 !p-[22px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-[15px] font-bold">{t("out.title")}</h2>
          <span className="text-[12px] text-faint">{t("out.internal")}</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[12px] text-ok">{t("common.saved")}</span>}
          <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3 pb-4 border-b border-line-soft">
        <h3 className="m-0 text-[13px] font-bold">{t("out.vendor")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {text("vendorName", t("out.name"))}
          {text("vendorContact", t("out.contact"))}
          {text("orderDate", t("out.orderDate"), "date")}
          {text("vendorEta", t("out.vendorEta"), "date")}
        </div>
      </section>

      <section className="flex flex-col gap-3 pb-4 border-b border-line-soft">
        <h3 className="m-0 text-[13px] font-bold">{t("out.printer")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {text("printerName", t("out.name"))}
          {text("printerContact", t("out.contact"))}
          {text("printMethod", t("out.printMethod"), "text", t("out.printMethodHint"))}
          {text("printerEta", t("out.printerEta"), "date")}
        </div>
      </section>

      <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5">
        <legend className="p-0 mb-2.5 text-[13px] font-bold">{t("out.shipping")}</legend>
        <div className="flex flex-wrap gap-2">
          {SHIPPING_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={o.shipping === s}
              onClick={() => up({ shipping: o.shipping === s ? undefined : s })}
              className={cx(
                "min-h-10 px-3 rounded-lg text-[13px] border cursor-pointer",
                o.shipping === s ? "bg-ink text-white border-ink" : "bg-white text-ink-2 border-[#DCDCD6]"
              )}
            >
              {t(`out.ship.${s}`)}
            </button>
          ))}
        </div>
        {o.shipping === "other" && (
          <input className="field" placeholder={t("out.shippingNote")} value={o.shippingNote ?? ""} onChange={(e) => up({ shippingNote: e.target.value })} />
        )}
        <span className="text-[12px] text-faint">{t("out.shippingHint")}</span>
      </fieldset>

    </Card>
  );
}
