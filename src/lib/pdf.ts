"use client";

/** 把画面上的 Order Form 版面输出成 A4 横向 PDF 并下载 */
export async function downloadSheetPdf(el: HTMLElement, fileName: string): Promise<void> {
  // 等图片与字体载入完成
  await Promise.all(
    Array.from(el.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r())))
    )
  );
  await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pw = 297;
  const ph = 210;
  const ratio = canvas.height / canvas.width;
  let w = pw;
  let h = pw * ratio;
  if (h > ph) {
    h = ph;
    w = ph / ratio;
  }
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pw - w) / 2, 0, w, h);
  pdf.save(fileName.replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf");
}
