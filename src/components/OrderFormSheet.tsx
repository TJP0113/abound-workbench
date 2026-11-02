"use client";

import type { CSSProperties, ReactNode } from "react";
import { SIZES, sheetDate, totalQty, type OrderForm, type PrintSpot } from "@/lib/orderform";
import { useOrderImage } from "@/lib/orderform-store";

// 版面只用行内样式与十六进制颜色，确保导出 PDF 时与画面一致
export const SHEET_W = 1123; // A4 横向（96dpi）：297 × 210 mm
export const SHEET_H = 794;
export const SHEET_MARGIN = 38; // 约 10mm 留白，印刷时不会被裁到

const BLACK = "#111111";
const LINE = `2px solid ${BLACK}`;
const THIN = "1px solid #D9D9D9";
const font = '"Helvetica Neue", Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

const lbl: CSSProperties = { fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", color: BLACK };
const val: CSSProperties = { fontSize: 12, color: BLACK, textTransform: "uppercase", overflowWrap: "anywhere" };

function Row({ label, value, valueStyle }: { label: string; value?: string; valueStyle?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 21, borderBottom: THIN, padding: "0 4px" }}>
      <span style={{ ...lbl, width: 92, flex: "none" }}>{label} :</span>
      <span style={{ ...val, flex: 1, textAlign: "center", ...valueStyle }}>{value || ""}</span>
    </div>
  );
}

function Cell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", ...style }}>{children}</div>;
}

function Header({ f }: { f: OrderForm }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 70, padding: "0 4px 10px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-on-light.png" alt="ABOUND CREATION" style={{ height: 48, width: "auto" }} />
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 0.5, color: BLACK }}>ORDER FORM</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "30% 30% 20% 20%", borderTop: LINE, borderBottom: LINE, height: 34 }}>
        <Cell style={{ borderRight: LINE }}>
          <span style={lbl}>COMPANY NAME :</span>
          <span style={val}>{f.company}</span>
        </Cell>
        <Cell style={{ borderRight: LINE }}>
          <span style={lbl}>JOB NAME :</span>
          <span style={val}>{f.jobName}</span>
        </Cell>
        <Cell style={{ borderRight: LINE, justifyContent: "space-between" }}>
          <span style={lbl}>ORDER DATE :</span>
          <span style={{ ...val, textTransform: "none" }}>{sheetDate(f.orderDate)}</span>
        </Cell>
        <Cell style={{ justifyContent: "space-between" }}>
          <span style={lbl}>DELIVERY DATE :</span>
          <span style={{ ...val, textTransform: "none" }}>{sheetDate(f.deliveryDate)}</span>
        </Cell>
      </div>
    </>
  );
}

/** 图片：在可用空间内等比例缩放（不会超出页面） */
function SheetImage({ id }: { id?: string }) {
  const src = useOrderImage(id);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top" }} />
      )}
    </div>
  );
}

function SpotBlock({ spot }: { spot: PrintSpot }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}>
      <div style={{ ...lbl, padding: "4px 4px 2px" }}>PRINT METHOD :</div>
      <div style={{ ...val, padding: "2px 10px 4px", borderBottom: THIN }}>{spot.method}</div>
      <Row label="COLOUR" value={spot.colour} valueStyle={{ textAlign: "left" }} />
      <Row label="SIZE" value={spot.size} valueStyle={{ textAlign: "left" }} />
      <Row label="REMARK" value={spot.remark} valueStyle={{ textAlign: "left", textTransform: "none" }} />
    </div>
  );
}

function Side({ title, spots, imageId, last }: { title: string; spots: PrintSpot[]; imageId?: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", borderRight: last ? "none" : LINE, minHeight: 0 }}>
      <div style={{ padding: "14px 0 8px" }}>
        <div style={{ display: "inline-block", border: LINE, borderLeft: "none", padding: "4px 0", width: 110, textAlign: "center", fontWeight: 800, fontSize: 14 }}>
          {title}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "40% 60%", gridTemplateRows: "minmax(0, 1fr)", flex: 1, minHeight: 0 }}>
        <div style={{ padding: "0 6px 0 4px", overflow: "hidden" }}>
          {spots.map((s, i) => (
            <SpotBlock key={i} spot={s} />
          ))}
        </div>
        <div style={{ padding: "0 10px 6px", minHeight: 0 }}>
          <SheetImage id={imageId} />
        </div>
      </div>
    </div>
  );
}

function UniformBody({ f }: { f: OrderForm }) {
  const sizes = SIZES[f.sizeGroup ?? "adult"];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "30% 20% 30% 20%", borderBottom: LINE }}>
        <div style={{ borderRight: LINE, padding: "4px 0" }}>
          <Row label="COLOUR" value={f.colour} />
          <Row label="CLOTH" value={f.cloth} />
          <Row label="MATERIAL" value={f.material} />
        </div>
        <div style={{ borderRight: LINE, padding: "4px 0" }}>
          <Row label="LABEL" value={f.label} />
          <Row label="PACKAGING" value={f.packaging} valueStyle={f.packaging === "NO NEEDED" ? { color: "#D11F1F" } : undefined} />
        </div>
        <div style={{ borderRight: LINE, padding: "4px 0" }}>
          <Row label="TYPE" value={f.type} />
          {f.sizeGroup === "kids" && <Row label="SIZE" value="KIDS" />}
        </div>
        <div style={{ padding: "6px 6px" }}>
          <div style={lbl}>REMARK :</div>
          <div style={{ fontSize: 12, color: BLACK, whiteSpace: "pre-wrap", marginTop: 4 }}>{f.remark}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${sizes.length}, minmax(0, 1fr)) 110px`, borderBottom: LINE }}>
        {sizes.map((s) => (
          <div key={s} style={{ borderRight: THIN, textAlign: "center" }}>
            <div style={{ ...lbl, padding: "6px 0 3px" }}>{s}</div>
            <div style={{ fontSize: 12, padding: "3px 0 6px" }}>{Number(f.sizes?.[s]) || 0}</div>
          </div>
        ))}
        <div style={{ borderLeft: LINE, textAlign: "center" }}>
          <div style={{ ...lbl, fontSize: 13, padding: "6px 0 3px" }}>TOTAL</div>
          <div style={{ fontSize: 12, padding: "3px 0 6px", fontWeight: 700 }}>{totalQty(f)} PCS</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "50% 50%", gridTemplateRows: "minmax(0, 1fr)", flex: 1, minHeight: 0 }}>
        <Side title="FRONT" spots={f.front?.length ? f.front : [{ method: "", colour: "", size: "", remark: "" }]} imageId={f.frontImage} />
        <Side title="BACK" spots={f.back?.length ? f.back : [{ method: "", colour: "", size: "", remark: "" }]} imageId={f.backImage} last />
      </div>
    </>
  );
}

function MerchBody({ f }: { f: OrderForm }) {
  const fields = (f.fields || []).filter((x) => x.label || x.value);
  const half = Math.ceil(fields.length / 2);
  const cols = [fields.slice(0, half), fields.slice(half)];
  const images = f.images || [];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "40% 40% 20%", borderBottom: LINE }}>
        {cols.map((c, i) => (
          <div key={i} style={{ borderRight: LINE, padding: "4px 0" }}>
            {c.map((x, j) => (
              <Row key={j} label={x.label.toUpperCase()} value={x.value} />
            ))}
          </div>
        ))}
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <div style={{ ...lbl, fontSize: 13 }}>QUANTITY</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{f.quantity}</div>
        </div>
      </div>
      {f.remark && (
        <div style={{ borderBottom: LINE, padding: "6px 8px", display: "flex", gap: 8 }}>
          <span style={lbl}>REMARK :</span>
          <span style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{f.remark}</span>
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(Math.max(images.length, 1), 4)}, minmax(0, 1fr))`,
          gridTemplateRows: "minmax(0, 1fr)",
          gap: 16,
          padding: "14px 0 0",
        }}
      >
        {images.map((im) => (
          <div key={im.id} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
              <SheetImage id={im.id} />
            </div>
            {im.caption && <div style={{ ...lbl, textAlign: "center" }}>{im.caption.toUpperCase()}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

/** Order Form 版面（A4 横向），用于预览与导出 PDF */
export function OrderFormSheet({ form, id }: { form: OrderForm; id?: string }) {
  return (
    <div
      id={id}
      style={{
        width: SHEET_W,
        height: SHEET_H,
        padding: SHEET_MARGIN,
        background: "#ffffff",
        color: BLACK,
        fontFamily: font,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Header f={form} />
        {form.kind === "merch" ? <MerchBody f={form} /> : <UniformBody f={form} />}
      </div>
    </div>
  );
}
