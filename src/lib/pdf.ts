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
 * 把 Order Form 版面（每张刚好一页 A4 横向）输出成 PDF。
 * combine = true：全部放进同一个 PDF；false：每张各自一个 PDF 档。
 */
export async function downloadSheetsPdf(items: { el: HTMLElement; name: string }[], combine: boolean, combinedName: string): Promise<void> {
  if (!items.length) return;
  await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  const render = async (el: HTMLElement) => {
    await waitImages(el);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    return canvas.toDataURL("image/jpeg", 0.92);
  };
  const newDoc = () => new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

  if (combine) {
    const pdf = newDoc();
    for (let i = 0; i < items.length; i++) {
      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(await render(items[i].el), "JPEG", 0, 0, 297, 210);
    }
    pdf.save(safe(combinedName));
    return;
  }
  for (const it of items) {
    const pdf = newDoc();
    pdf.addImage(await render(it.el), "JPEG", 0, 0, 297, 210);
    pdf.save(safe(it.name));
    await new Promise((r) => setTimeout(r, 400)); // 让浏览器逐一下载
  }
}
