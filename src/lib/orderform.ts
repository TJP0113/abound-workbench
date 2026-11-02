// Order Form：制服 / 周边订单表（给顾客、厂商、印刷厂参考）

export type OrderFormKind = "uniform" | "merch";
export type SizeGroup = "adult" | "kids";

export interface PrintSpot {
  method: string;
  colour: string;
  size: string;
  remark: string;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface OrderImage {
  id: string; // orderImages 文件 ID
  caption?: string;
}

export interface OrderForm {
  id: string;
  projectId: string;
  memberEmails: string[]; // 从项目复制，用于权限
  kind: OrderFormKind;
  title: string; // 内部辨识用，例如「员工 T 恤」
  company: string;
  jobName: string;
  orderDate: string;
  deliveryDate: string;
  remark: string;
  // 制服
  colour?: string;
  cloth?: string;
  material?: string;
  label?: string;
  packaging?: string;
  type?: string;
  sizeGroup?: SizeGroup;
  sizes?: Record<string, number>;
  front?: PrintSpot[];
  back?: PrintSpot[];
  frontImage?: string;
  backImage?: string;
  // 周边
  quantity?: string;
  fields?: CustomField[];
  images?: OrderImage[];
  createdAt?: number;
  updatedAt?: number;
}

export const MATERIALS = ["MICROFIBER", "COTTON", "NYLON", "VISCOSE", "SPANDEX", "HONEYCOMB"];
export const LABELS = ["NORMAL", "REMOVE"];
export const PACKAGINGS = ["NEEDED", "NO NEEDED"];
export const TYPES = ["SAMPLE", "REPEAT ORDER", "CUSTOM MADE", "MASS", "NORMAL"];
export const PRINT_METHODS = ["DYE SUBLIMATION", "SILKSCREEN", "HEAT TRANSFER", "DTF", "EMBROIDERY", "NONE"];

export const SIZES: Record<SizeGroup, string[]> = {
  adult: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "5XL", "7XL"],
  kids: ["2", "4", "6", "8", "10", "12", "14"],
};

export const MERCH_FIELD_SUGGESTIONS = ["ITEM", "MATERIAL", "COLOUR", "SIZE", "PRINT METHOD", "FINISHING", "PACKAGING"];

export const emptySpot = (method = ""): PrintSpot => ({ method, colour: "", size: "", remark: "" });

export function totalQty(f: Pick<OrderForm, "sizes" | "sizeGroup">): number {
  const keys = SIZES[f.sizeGroup ?? "adult"];
  return keys.reduce((a, k) => a + (Number(f.sizes?.[k]) || 0), 0);
}

export function newOrderForm(
  kind: OrderFormKind,
  project: { id: string; name: string; client: string; dueDate: string; memberEmails: string[] },
  today: string
): Omit<OrderForm, "id"> {
  const base = {
    projectId: project.id,
    memberEmails: project.memberEmails,
    kind,
    title: "",
    company: project.client || "",
    jobName: "",
    orderDate: today,
    deliveryDate: project.dueDate || "",
    remark: "",
  };
  if (kind === "merch")
    return {
      ...base,
      quantity: "",
      fields: [
        { label: "ITEM", value: "" },
        { label: "MATERIAL", value: "" },
        { label: "PRINT METHOD", value: "" },
      ],
      images: [],
    };
  return {
    ...base,
    colour: "",
    cloth: "",
    material: "MICROFIBER",
    label: "NORMAL",
    packaging: "NO NEEDED",
    type: "CUSTOM MADE",
    sizeGroup: "adult",
    sizes: {},
    front: [emptySpot("DYE SUBLIMATION")],
    back: [emptySpot("DYE SUBLIMATION")],
  };
}

/** 日期显示成 30-Sep-2026（与原本表格一致） */
export function sheetDate(s?: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m || 1) - 1];
  return `${String(d).padStart(2, "0")}-${mon}-${y}`;
}

/**
 * 压缩图片：最长边 1600px，JPEG；透明背景补白色。
 * 结果控制在约 700KB 以内，才能存进资料库（单笔上限 1MB）。
 */
export async function compressImage(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    let max = 1600;
    let quality = 0.85;
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = c.toDataURL("image/jpeg", quality);
      if (data.length < 700_000) return data;
      if (quality > 0.6) quality -= 0.1;
      else max = Math.round(max * 0.8);
    }
    throw new Error("image too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
