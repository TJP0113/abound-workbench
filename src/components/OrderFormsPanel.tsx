"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, EmptyState, Icon, Modal, Pill, Segmented } from "./ui";
import { OrderFormEditor } from "./OrderFormEditor";
import { OrderFormSheet } from "./OrderFormSheet";
import { newOrderForm, totalQty, type OrderForm, type OrderFormKind } from "@/lib/orderform";
import { deleteOrderForm, loadOrderImage, saveOrderForm, uploadOrderImage, useOrderForms } from "@/lib/orderform-store";
import { buildSheetsPdf, canShareFiles, downloadFiles, shareFiles } from "@/lib/pdf";
import { formatDate, todayStr } from "@/lib/dates";
import type { Project } from "@/lib/types";

const MODE_KEY = "abound.pdfMode";

const fileName = (f: OrderForm) => ["ORDER FORM", f.company, f.jobName || f.title].filter(Boolean).join(" - ");

/** 项目页：Order Form 列表（制服 / 周边），可新建多张、编辑、复制、下载 PDF（合并或分开） */
export function OrderFormsPanel({ project }: { project: Project }) {
  const { t, lang } = useAuth();
  const forms = useOrderForms(project.id);
  const [editing, setEditing] = useState<{ form?: OrderForm; initial?: Omit<OrderForm, "id"> } | null>(null);
  const [exporting, setExporting] = useState<{ list: OrderForm[]; combine: boolean; share?: boolean } | null>(null);
  const [pendingShare, setPendingShare] = useState<File[] | null>(null);
  const [shareable, setShareable] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setModeState] = useState<"combine" | "separate">("combine");
  const [busyId, setBusyId] = useState<string | null>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 这个浏览器能不能直接分享 PDF 文件（手机、Windows / Mac 的 Chrome、Safari 大多可以）
    setShareable(canShareFiles([new File(["x"], "x.pdf", { type: "application/pdf" })]));
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "combine" || m === "separate") setModeState(m);
    } catch {
      /* 忽略 */
    }
  }, []);
  const setMode = (m: "combine" | "separate") => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* 忽略 */
    }
  };

  // 清掉已删除的勾选
  useEffect(() => {
    setSelected((s) => s.filter((id) => forms.some((f) => f.id === id)));
  }, [forms]);

  const kinds: OrderFormKind[] = [
    ...(project.services.some((s) => s.type === "uniform") ? (["uniform"] as const) : []),
    ...(project.services.some((s) => s.type === "merch") ? (["merch"] as const) : []),
  ];

  // 在画面外渲染版面，再输出 PDF
  useEffect(() => {
    if (!exporting) return;
    let alive = true;
    (async () => {
      const ids = exporting.list.flatMap((f) => [f.frontImage, f.backImage, ...(f.images || []).map((i) => i.id)]).filter(Boolean) as string[];
      await Promise.all(ids.map((id) => loadOrderImage(id).catch(() => "")));
      await new Promise((r) => setTimeout(r, 300));
      const els = Array.from(sheetsRef.current?.children || []) as HTMLElement[];
      if (alive && els.length) {
        const items = exporting.list.map((f, i) => ({ el: els[i], name: fileName(f) }));
        const combinedName = `ORDER FORM - ${project.client || project.name}${exporting.list.length > 1 ? ` (${exporting.list.length})` : ""}`;
        const name = exporting.list.length === 1 ? fileName(exporting.list[0]) : combinedName;
        try {
          const files = await buildSheetsPdf(items, exporting.combine, name);
          if (!exporting.share) await downloadFiles(files);
          else {
            const r = await shareFiles(files, name);
            // 生成 PDF 花了较久，浏览器要求再按一次才能打开分享面板
            if (r === "blocked") setPendingShare(files);
            else if (r === "unsupported") {
              await downloadFiles(files);
              alert(t("share.unsupported"));
            }
          }
        } catch (e) {
          console.error(e);
          alert(t("err.generic"));
        }
      }
      if (alive) setExporting(null);
    })();
    return () => {
      alive = false;
    };
  }, [exporting, t, project.client, project.name]);

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

  const chosen = forms.filter((f) => selected.includes(f.id));
  const allOn = forms.length > 0 && chosen.length === forms.length;

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

      {forms.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-[10px] bg-well border border-line-soft">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-[#2D45C8]"
              checked={allOn}
              onChange={(e) => setSelected(e.target.checked ? forms.map((f) => f.id) : [])}
            />
            {t("of.selectAll")}
          </label>
          <Segmented
            label={t("of.pdfMode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "combine", label: t("of.combine") },
              { value: "separate", label: t("of.separate") },
            ]}
          />
          <Button size="sm" variant="dark" disabled={!chosen.length || !!exporting} onClick={() => setExporting({ list: chosen, combine: mode === "combine" })} className="ml-auto">
            {exporting && exporting.list.length > 1 && !exporting.share ? t("of.exporting") : t("of.downloadSelected", { n: chosen.length })}
          </Button>
          {shareable && (
            <Button size="sm" variant="primary" disabled={!chosen.length || !!exporting} onClick={() => setExporting({ list: chosen, combine: mode === "combine", share: true })}>
              <Icon name="share" size={14} />
              {exporting && exporting.list.length > 1 && exporting.share ? t("of.exporting") : t("share.selected", { n: chosen.length })}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {forms.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-line-soft">
            <input
              type="checkbox"
              aria-label={f.title || f.jobName || "ORDER FORM"}
              className="w-5 h-5 accent-[#2D45C8] flex-none"
              checked={selected.includes(f.id)}
              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))}
            />
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
              <Button size="sm" variant="dark" disabled={!!exporting} onClick={() => setExporting({ list: [f], combine: true })}>
                {exporting?.list.length === 1 && exporting.list[0].id === f.id && !exporting.share ? t("of.exporting") : "PDF"}
              </Button>
              {shareable && (
                <Button size="sm" variant="primary" disabled={!!exporting} onClick={() => setExporting({ list: [f], combine: true, share: true })}>
                  <Icon name="share" size={14} />
                  {exporting?.list.length === 1 && exporting.list[0].id === f.id && exporting.share ? t("of.exporting") : t("share.button")}
                </Button>
              )}
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
        <OrderFormEditor
          open
          form={editing.form}
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onExport={(f) => setExporting({ list: [f], combine: true })}
        />
      )}
      {pendingShare && (
        <Modal
          open
          onClose={() => setPendingShare(null)}
          title={t("share.readyTitle")}
          footer={
            <>
              <Button
                onClick={async () => {
                  await downloadFiles(pendingShare);
                  setPendingShare(null);
                }}
              >
                <Icon name="download" size={16} />
                {t("share.download")}
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const files = pendingShare;
                  setPendingShare(null);
                  await shareFiles(files, files[0]?.name || "ORDER FORM").catch(() => alert(t("err.generic")));
                }}
              >
                <Icon name="share" size={16} />
                {t("share.button")}
              </Button>
            </>
          }
        >
          <p className="m-0 text-[14px]">{t("share.readyBody", { n: pendingShare.length })}</p>
          <ul className="m-0 pl-5 text-[13px] text-muted">
            {pendingShare.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        </Modal>
      )}
      {exporting && (
        <div ref={sheetsRef} aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          {exporting.list.map((f) => (
            <OrderFormSheet key={f.id} form={f} />
          ))}
        </div>
      )}
    </Card>
  );
}
