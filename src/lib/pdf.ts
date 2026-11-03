"use client";

async function waitImages(el: HTMLElement) {
  await Promise.all(
    Array.from(el.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r())))
    )
  );
}

const safe = (n: string) => n.replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf";

/**
 * 把 Order Form 版面（每张刚好一页 A4 横向）生成 PDF 文件。
 * combine = true：全部放进同一个 PDF；false：每张各自一个 PDF。
 */
export async function buildSheetsPdf(items: { el: HTMLElement; name: string }[], combine: boolean, combinedName: string): Promise<File[]> {
  if (!items.length) return [];
  await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  const render = async (el: HTMLElement) => {
    await waitImages(el);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    return canvas.toDataURL("image/jpeg", 0.92);
  };
  const newDoc = () => new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const toFile = (pdf: InstanceType<typeof jsPDF>, name: string) => new File([pdf.output("blob")], safe(name), { type: "application/pdf" });

  if (combine) {
    const pdf = newDoc();
    for (let i = 0; i < items.length; i++) {
      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(await render(items[i].el), "JPEG", 0, 0, 297, 210);
    }
    return [toFile(pdf, combinedName)];
  }
  const out: File[] = [];
  for (const it of items) {
    const pdf = newDoc();
    pdf.addImage(await render(it.el), "JPEG", 0, 0, 297, 210);
    out.push(toFile(pdf, it.name));
  }
  return out;
}

export async function downloadFiles(files: File[]): Promise<void> {
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    await new Promise((r) => setTimeout(r, 400)); // 让浏览器逐一下载
  }
}

export async function downloadSheetsPdf(items: { el: HTMLElement; name: string }[], combine: boolean, combinedName: string): Promise<void> {
  await downloadFiles(await buildSheetsPdf(items, combine, combinedName));
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * 用系统分享面板发送 PDF（手机 / 电脑上可选 WhatsApp）。
 * 结果："shared" 已分享或使用者取消；"blocked" 浏览器要求再按一次（生成太久失去点击授权）；"unsupported" 不支持。
 */
export async function shareFiles(files: File[], title: string): Promise<"shared" | "blocked" | "unsupported"> {
  if (!canShareFiles(files)) return "unsupported";
  try {
    await navigator.share({ files, title });
    return "shared";
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "AbortError") return "shared";
    if (name === "NotAllowedError") return "blocked";
    throw e;
  }
}
