import type { EventType, ProjectService, ServiceType, UniformVariant } from "./types";

export const SERVICE_TYPES: ServiceType[] = ["brand", "uniform", "social", "merch", "graphic", "photo", "other"];

// 背景色 / 文字色（与原型一致）
export const SERVICE_COLORS: Record<ServiceType, [string, string]> = {
  brand: ["#E9ECFB", "#2D45C8"],
  uniform: ["#F7EADF", "#8A4310"],
  social: ["#F6E6F0", "#8E2A63"],
  merch: ["#E3F1EE", "#1F6B5C"],
  graphic: ["#EFEAF8", "#5B3A9E"],
  photo: ["#EDEDEA", "#3F4146"],
  other: ["#F3EFDF", "#6B5512"],
};

export const EVENT_COLORS: Record<EventType, { bg: string; fg: string; solid: string; gcal: string }> = {
  delivery: { bg: "#FCE8E8", fg: "#A82828", solid: "#C42B2B", gcal: "11" },
  deadline: { bg: "#FBEEE2", fg: "#8F4510", solid: "#D9731A", gcal: "6" },
  meeting: { bg: "#E9ECFB", fg: "#2D45C8", solid: "#2D45C8", gcal: "9" },
  internal: { bg: "#E3F2E8", fg: "#23683F", solid: "#2F7D4F", gcal: "10" },
};

const STAGES: Record<string, string[]> = {
  brand: ["brief", "research", "proposal", "revise", "presentConfirm", "deliverBrand"],
  "uniform:readymade": ["brief", "selectDesign", "confirmSpec", "orderVendor", "outsourcePrint", "pack", "ship", "deliver"],
  "uniform:custom": [
    "brief",
    "styleDesign",
    "sample",
    "confirmSample",
    "orderVendor",
    "vendorProduce",
    "outsourcePrint",
    "pack",
    "ship",
    "deliver",
  ],
  social: ["brief", "contentPlan", "clientConfirm", "contentMake", "publish", "monthlyReport"],
  merch: ["brief", "design", "sample", "confirm", "produce", "deliver"],
  graphic: ["brief", "firstDraft", "revise", "presentConfirm", "deliverPrint"],
  photo: ["brief", "shootPlan", "shoot", "post", "clientConfirm", "deliver"],
  other: [], // 杂事：由使用者自行填写步骤
};

export function serviceKey(type: ServiceType, variant?: UniformVariant): string {
  return type === "uniform" ? `uniform:${variant ?? "readymade"}` : type;
}

export function defaultStages(type: ServiceType, variant?: UniformVariant): string[] {
  return (STAGES[serviceKey(type, variant)] ?? STAGES.brand).map((s) => `stage.${s}`);
}

export function newService(type: ServiceType, variant?: UniformVariant): ProjectService {
  const svc: ProjectService = { type, stages: defaultStages(type, variant), current: 0 };
  if (type === "uniform") svc.variant = variant ?? "readymade";
  return svc;
}

/** 单项服务的完成百分比（按已完成阶段计算） */
export function serviceProgress(s: ProjectService): number {
  if (!s.stages.length) return 0;
  return Math.round((Math.min(s.current, s.stages.length) / s.stages.length) * 100);
}

export const SHIPPING_OPTIONS = ["vendorToPrinter", "viaStudio", "vendorToClient", "other"] as const;
export const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];
