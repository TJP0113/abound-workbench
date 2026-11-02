"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Field, Icon, Modal, Segmented, cx } from "./ui";
import { OrderFormSheet, SHEET_W } from "./OrderFormSheet";
import {
  LABELS,
  MATERIALS,
  MERCH_FIELD_SUGGESTIONS,
  PACKAGINGS,
  PRINT_METHODS,
  SIZES,
  TYPES,
  compressImage,
  emptySpot,
  totalQty,
  type OrderForm,
  type PrintSpot,
} from "@/lib/orderform";
import { deleteOrderImage, saveOrderForm, uploadOrderImage, useOrderImage } from "@/lib/orderform-store";

type Draft = Omit<OrderForm, "id">;

/** 图片栏：选择档案、拖放、或点一下后按 Ctrl+V 贴上截图 */
function ImageInput({
  imageId,
  onPick,
  onRemove,
  busy,
}: {
  imageId?: string;
  onPick: (file: Blob) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const { t } = useAuth();
  const src = useOrderImage(imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={t("of.image")}
      onPaste={(e) => {
        const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
        const f = item?.getAsFile();
        if (f) {
          e.preventDefault();
          onPick(f);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
        if (f) onPick(f);
      }}
      className={cx(
        "rounded-[12px] border-2 border-dashed p-3 flex flex-col items-center gap-2 text-center outline-none focus:border-accent",
        over ? "border-accent bg-accent-soft" : "border-[#D6D6D0] bg-well"
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-h-[220px] max-w-full object-contain" />
      ) : (
        <div className="py-6 text-[13px] text-muted">{busy ? t("of.uploading") : t("of.pasteHint")}</div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {src ? t("of.replaceImage") : t("of.chooseImage")}
        </Button>
        {src && (
          <Button size="sm" variant="danger" onClick={onRemove} disabled={busy}>
            {t("common.delete")}
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SpotsEditor({ title, spots, onChange }: { title: string; spots: PrintSpot[]; onChange: (s: PrintSpot[]) => void }) {
  const { t } = useAuth();
  const set = (i: number, p: Partial<PrintSpot>) => onChange(spots.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="flex flex-col gap-3">
      {spots.map((s, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 p-3 rounded-[10px] border border-line bg-white">
          <div className="col-span-2 flex items-end gap-2">
            <Field label={`${title} · PRINT METHOD ${spots.length > 1 ? i + 1 : ""}`}>
              <input className="field" list="of-print-methods" value={s.method} onChange={(e) => set(i, { method: e.target.value.toUpperCase() })} />
            </Field>
            {spots.length > 1 && (
              <button
                type="button"
                aria-label={t("common.delete")}
                onClick={() => onChange(spots.filter((_, j) => j !== i))}
                className="w-10 h-[42px] rounded-lg text-danger hover:bg-danger-soft cursor-pointer flex-none"
              >
                ×
              </button>
            )}
          </div>
          <Field label="COLOUR">
            <input className="field" value={s.colour} onChange={(e) => set(i, { colour: e.target.value })} />
          </Field>
          <Field label="SIZE">
            <input className="field" value={s.size} onChange={(e) => set(i, { size: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="REMARK">
              <input className="field" value={s.remark} onChange={(e) => set(i, { remark: e.target.value })} />
            </Field>
          </div>
        </div>
      ))}
      <div>
        <Button size="sm" onClick={() => onChange([...spots, emptySpot("NONE")])}>
          <Icon name="plus" size={14} />
          {t("of.addSpot")}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-[13px] font-bold tracking-wide text-ink-2">{title}</h3>
      {children}
    </section>
  );
}

export function OrderFormEditor({
  open,
  onClose,
  form,
  initial,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  form?: OrderForm; // 编辑现有
  initial?: Draft; // 新建
  onExport: (f: OrderForm) => void;
}) {
  const { t } = useAuth();
  const [f, setF] = useState<Draft>(() => (form ? { ...form } : initial!));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const uploaded = useRef<string[]>([]); // 这次新上传的图片
  const replaced = useRef<string[]>([]); // 存档后要删除的旧图片
  const saved = useRef(false);
  const previewBox = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  const sheetBox = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(794);
  const up = (p: Partial<Draft>) => setF((o) => ({ ...o, ...p }));
  const original = useRef(new Set([form?.frontImage, form?.backImage, ...(form?.images || []).map((i) => i.id)].filter(Boolean) as string[]));

  useEffect(() => {
    if (tab !== "preview" || !previewBox.current) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / SHEET_W)));
    ro.observe(previewBox.current);
    const ro2 = new ResizeObserver(([e]) => setSheetH(e.contentRect.height));
    if (sheetBox.current) ro2.observe(sheetBox.current);
    return () => {
      ro.disconnect();
      ro2.disconnect();
    };
  }, [tab]);

  // 关闭但没存档：删除这次上传的图片
  const close = () => {
    if (!saved.current) uploaded.current.forEach((id) => deleteOrderImage(id));
    onClose();
  };

  const putImage = async (slot: string, file: Blob, apply: (id: string) => void, oldId?: string) => {
    setUploading(slot);
    setError("");
    try {
      const data = await compressImage(file);
      const id = await uploadOrderImage(data, f.projectId, f.memberEmails);
      uploaded.current.push(id);
      if (oldId) dropImage(oldId);
      apply(id);
    } catch (e) {
      console.error(e);
      setError(t("of.imageError"));
    } finally {
      setUploading(null);
    }
  };

  const dropImage = (id?: string) => {
    if (!id) return;
    if (original.current.has(id)) replaced.current.push(id);
    else {
      uploaded.current = uploaded.current.filter((x) => x !== id);
      deleteOrderImage(id);
    }
  };

  const save = async (andExport?: boolean) => {
    setBusy(true);
    setError("");
    try {
      const id = await saveOrderForm(f, form?.id);
      saved.current = true;
      replaced.current.forEach((x) => deleteOrderImage(x));
      onClose();
      if (andExport) onExport({ ...f, id });
    } catch (e) {
      console.error(e);
      setError(t("err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const sizes = SIZES[f.sizeGroup ?? "adult"];
  const isMerch = f.kind === "merch";

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={`${isMerch ? t("of.merch") : t("of.uniform")} · ORDER FORM`}
      footer={
        <>
          {error && <span className="mr-auto self-center text-[13px] text-danger">{error}</span>}
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button onClick={() => save(true)} disabled={busy || !!uploading}>
            {t("of.saveAndPdf")}
          </Button>
          <Button variant="primary" onClick={() => save()} disabled={busy || !!uploading}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <datalist id="of-print-methods">
        {PRINT_METHODS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="of-materials">
        {MATERIALS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id="of-merch-fields">
        {MERCH_FIELD_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <Segmented
        label="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "edit", label: t("common.edit") },
          { value: "preview", label: t("of.preview") },
        ]}
      />

      {tab === "preview" ? (
        <div ref={previewBox} className="w-full overflow-hidden border border-line rounded-[10px] bg-white">
          <div style={{ width: SHEET_W * scale, height: sheetH * scale }}>
            <div ref={sheetBox} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_W }}>
              <OrderFormSheet form={{ ...f, id: form?.id ?? "draft" }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Field label={t("of.internalName")} hint={t("of.internalHint")}>
            <input className="field" value={f.title} placeholder={isMerch ? "e.g. 纪念品 · 钥匙圈" : "e.g. 员工 T 恤"} onChange={(e) => up({ title: e.target.value })} />
          </Field>

          <Section title="HEADER">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="COMPANY NAME">
                <input className="field" value={f.company} onChange={(e) => up({ company: e.target.value })} />
              </Field>
              <Field label="JOB NAME">
                <input className="field" value={f.jobName} onChange={(e) => up({ jobName: e.target.value })} />
              </Field>
              <Field label="ORDER DATE">
                <input type="date" className="field" value={f.orderDate} onChange={(e) => up({ orderDate: e.target.value })} />
              </Field>
              <Field label="DELIVERY DATE">
                <input type="date" className="field" value={f.deliveryDate} onChange={(e) => up({ deliveryDate: e.target.value })} />
              </Field>
            </div>
          </Section>

          {!isMerch ? (
            <>
              <Section title="DETAILS">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="COLOUR">
                    <input className="field" value={f.colour ?? ""} onChange={(e) => up({ colour: e.target.value })} />
                  </Field>
                  <Field label="CLOTH">
                    <input className="field" value={f.cloth ?? ""} placeholder="e.g. 160GSM EYELET" onChange={(e) => up({ cloth: e.target.value })} />
                  </Field>
                  <Field label="MATERIAL">
                    <input className="field" list="of-materials" value={f.material ?? ""} onChange={(e) => up({ material: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="LABEL">
                    <select className="field" value={f.label} onChange={(e) => up({ label: e.target.value })}>
                      {LABELS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="PACKAGING">
                    <select className="field" value={f.packaging} onChange={(e) => up({ packaging: e.target.value })}>
                      {PACKAGINGS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="TYPE">
                    <select className="field" value={f.type} onChange={(e) => up({ type: e.target.value })}>
                      {TYPES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="REMARK">
                  <textarea className="field" value={f.remark} onChange={(e) => up({ remark: e.target.value })} />
                </Field>
              </Section>

              <Section title="SIZES">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    label={t("of.sizeGroup")}
                    value={f.sizeGroup ?? "adult"}
                    onChange={(g) => up({ sizeGroup: g })}
                    options={[
                      { value: "adult", label: t("of.adult") },
                      { value: "kids", label: t("of.kids") },
                    ]}
                  />
                  <span className="text-[14px] font-bold">TOTAL {totalQty(f)} PCS</span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(76px, 1fr))` }}>
                  {sizes.map((s) => (
                    <Field key={s} label={s}>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="field text-center"
                        value={f.sizes?.[s] ?? ""}
                        onChange={(e) => up({ sizes: { ...f.sizes, [s]: Math.max(0, Number(e.target.value) || 0) } })}
                      />
                    </Field>
                  ))}
                </div>
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(["front", "back"] as const).map((side) => {
                  const key = side === "front" ? "frontImage" : "backImage";
                  return (
                    <Section key={side} title={side.toUpperCase()}>
                      <ImageInput
                        imageId={f[key]}
                        busy={uploading === side}
                        onPick={(file) => putImage(side, file, (id) => up({ [key]: id }), f[key])}
                        onRemove={() => {
                          dropImage(f[key]);
                          up({ [key]: undefined });
                        }}
                      />
                      <SpotsEditor title={side.toUpperCase()} spots={f[side] ?? []} onChange={(s) => up({ [side]: s })} />
                    </Section>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <Section title="DETAILS">
                <Field label="QUANTITY">
                  <input className="field max-w-[240px]" value={f.quantity ?? ""} placeholder="e.g. 300 PCS" onChange={(e) => up({ quantity: e.target.value })} />
                </Field>
                <div className="flex flex-col gap-2">
                  {(f.fields || []).map((x, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="field !w-[34%] font-medium"
                        list="of-merch-fields"
                        aria-label={t("of.fieldName")}
                        placeholder={t("of.fieldName")}
                        value={x.label}
                        onChange={(e) => up({ fields: f.fields!.map((y, j) => (j === i ? { ...y, label: e.target.value.toUpperCase() } : y)) })}
                      />
                      <input
                        className="field"
                        aria-label={t("of.fieldValue")}
                        placeholder={t("of.fieldValue")}
                        value={x.value}
                        onChange={(e) => up({ fields: f.fields!.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)) })}
                      />
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        onClick={() => up({ fields: f.fields!.filter((_, j) => j !== i) })}
                        className="w-10 h-10 flex-none rounded-lg text-danger hover:bg-danger-soft cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div>
                    <Button size="sm" onClick={() => up({ fields: [...(f.fields || []), { label: "", value: "" }] })}>
                      <Icon name="plus" size={14} />
                      {t("of.addField")}
                    </Button>
                  </div>
                </div>
                <Field label="REMARK">
                  <textarea className="field" value={f.remark} onChange={(e) => up({ remark: e.target.value })} />
                </Field>
              </Section>
              <Section title="IMAGES">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(f.images || []).map((im, i) => (
                    <div key={im.id} className="flex flex-col gap-2">
                      <ImageInput
                        imageId={im.id}
                        busy={uploading === `m${i}`}
                        onPick={(file) =>
                          putImage(`m${i}`, file, (id) => setF((o) => ({ ...o, images: (o.images || []).map((y, j) => (j === i ? { ...y, id } : y)) })), im.id)
                        }
                        onRemove={() => {
                          dropImage(im.id);
                          up({ images: f.images!.filter((_, j) => j !== i) });
                        }}
                      />
                      <input
                        className="field"
                        placeholder={t("of.caption")}
                        aria-label={t("of.caption")}
                        value={im.caption ?? ""}
                        onChange={(e) => up({ images: f.images!.map((y, j) => (j === i ? { ...y, caption: e.target.value } : y)) })}
                      />
                    </div>
                  ))}
                  {(f.images || []).length < 4 && (
                    <ImageInput
                      busy={uploading === "new"}
                      onPick={(file) => putImage("new", file, (id) => setF((o) => ({ ...o, images: [...(o.images || []), { id, caption: "" }] })))}
                      onRemove={() => {}}
                    />
                  )}
                </div>
              </Section>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
