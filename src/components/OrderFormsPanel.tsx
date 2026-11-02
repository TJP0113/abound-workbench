"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, EmptyState, Icon, Pill } from "./ui";
import { OrderFormEditor } from "./OrderFormEditor";
import { OrderFormSheet } from "./OrderFormSheet";
import { newOrderForm, totalQty, type OrderForm, type OrderFormKind } from "@/lib/orderform";
import { deleteOrderForm, loadOrderImage, saveOrderForm, uploadOrderImage, useOrderForms } from "@/lib/orderform-store";
import { downloadSheetPdf } from "@/lib/pdf";
import { formatDate, todayStr } from "@/lib/dates";
import type { Project } from "@/lib/types";

/** 项目页：Order Form 列表（制服 / 周边），可新建多张、编辑、复制、下载 PDF */
export function OrderFormsPanel({ project }: { project: Project }) {
  const { t, lang } = useAuth();
  const forms = useOrderForms(project.id);
  const [editing, setEditing] = useState<{ form?: OrderForm; initial?: Omit<OrderForm, "id"> } | null>(null);
  const [exporting, setExporting] = useState<OrderForm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const kinds: OrderFormKind[] = [
    ...(project.services.some((s) => s.type === "uniform") ? (["uniform"] as const) : []),
    ...(project.services.some((s) => s.type === "merch") ? (["merch"] as const) : []),
  ];

  // 在画面外渲染版面，再输出 PDF
  useEffect(() => {
    if (!exporting) return;
    let alive = true;
    (async () => {
      // 先把图片从资料库载入，再等画面更新
      const ids = [exporting.frontImage, exporting.backImage, ...(exporting.images || []).map((i) => i.id)].filter(Boolean) as string[];
      await Promise.all(ids.map((id) => loadOrderImage(id).catch(() => "")));
      await new Promise((r) => setTimeout(r, 300));
      const el = sheetRef.current?.firstElementChild as HTMLElement | null;
      if (el && alive) {
        const name = ["ORDER FORM", exporting.company, exporting.jobName || exporting.title].filter(Boolean).join(" - ");
        await downloadSheetPdf(el, name).catch((e) => {
          console.error(e);
          alert(t("err.generic"));
        });
      }
      if (alive) setExporting(null);
    })();
    return () => {
      alive = false;
    };
  }, [exporting, t]);

  const duplicate = async (f: OrderForm) => {
    setBusyId(f.id);
    try {
      // 图片也复制一份，避免删除其中一张时影响另一张
      const copyImg = async (id?: string) => (id ? uploadOrderImage(await loadOrderImage(id), f.projectId, f.memberEmails) : undefined);
      const { id: _old, ...rest } = f;
      void _old;
      await saveOrderForm({
        ...rest,
        title: `${f.title || f.jobName || "ORDER FORM"} (copy)`,
        frontImage: await copyImg(f.frontImage),
        backImage: await copyImg(f.backImage),
        images: f.images ? await Promise.all(f.images.map(async (im) => ({ ...im, id: (await copyImg(im.id))! }))) : undefined,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error(e);
      alert(t("err.generic"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="flex flex-col gap-3.5 !p-[22px]">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="m-0 text-[15px] font-bold">ORDER FORM</h2>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <Button key={k} size="sm" variant={k === kinds[0] ? "primary" : "secondary"} onClick={() => setEditing({ initial: newOrderForm(k, project, todayStr()) })}>
              <Icon name="plus" size={14} />
              {t(k === "uniform" ? "of.newUniform" : "of.newMerch")}
            </Button>
          ))}
        </div>
      </div>

      {forms.length === 0 && <EmptyState>{t("of.empty")}</EmptyState>}
      <div className="flex flex-col">
        {forms.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-line-soft">
            <Pill bg={f.kind === "merch" ? "#E3F1EE" : "#F7EADF"} fg={f.kind === "merch" ? "#1F6B5C" : "#8A4310"}>
              {t(f.kind === "merch" ? "of.merch" : "of.uniform")}
            </Pill>
            <button type="button" onClick={() => setEditing({ form: f })} className="flex-[1_1_200px] min-w-0 text-left flex flex-col gap-0.5 cursor-pointer">
              <span className="text-[14px] font-medium truncate">{f.title || f.jobName || "ORDER FORM"}</span>
              <span className="text-[12px] text-muted truncate">
                {[f.jobName && f.title ? f.jobName : "", f.kind === "merch" ? f.quantity : `${totalQty(f)} PCS`, f.deliveryDate && `${t("proj.due")} ${formatDate(f.deliveryDate, lang)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => setEditing({ form: f })}>
                {t("common.edit")}
              </Button>
              <Button size="sm" variant="dark" disabled={!!exporting} onClick={() => setExporting(f)}>
                {exporting?.id === f.id ? t("of.exporting") : "PDF"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busyId === f.id} onClick={() => duplicate(f)}>
                {t("of.duplicate")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={t("common.delete")}
                onClick={async () => {
                  if (confirm(t("common.confirmDelete"))) await deleteOrderForm(f);
                }}
              >
                <Icon name="trash" size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="m-0 text-[12px] text-faint">{t("of.hint")}</p>

      {editing && (
        <OrderFormEditor open form={editing.form} initial={editing.initial} onClose={() => setEditing(null)} onExport={(f) => setExporting(f)} />
      )}
      {exporting && (
        <div ref={sheetRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          <OrderFormSheet form={exporting} />
        </div>
      )}
    </Card>
  );
}
