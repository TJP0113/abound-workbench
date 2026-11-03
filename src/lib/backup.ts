"use client";

import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/** 备份包含的资料（通知和 Google Calendar 连接设定不备份） */
export const BACKUP_COLLECTIONS = ["members", "projects", "tasks", "orderForms", "orderImages", "events"] as const;

export interface BackupFile {
  app: "abound-workbench";
  version: 1;
  exportedAt: number;
  exportedBy: string;
  collections: Record<string, Record<string, Record<string, unknown>>>;
}

export async function exportBackup(me: string): Promise<{ file: File; counts: Record<string, number> }> {
  const out: BackupFile = { app: "abound-workbench", version: 1, exportedAt: Date.now(), exportedBy: me, collections: {} };
  const counts: Record<string, number> = {};
  // 先记录备份时间，这样备份文件里也带着这个时间（还原后不会显示「没有备份过」）
  await updateDoc(doc(db(), "members", me), { lastBackupAt: out.exportedAt }).catch(() => {});
  for (const c of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db(), c));
    const map: Record<string, Record<string, unknown>> = {};
    snap.forEach((d) => (map[d.id] = d.data() as Record<string, unknown>));
    out.collections[c] = map;
    counts[c] = snap.size;
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const file = new File([JSON.stringify(out)], `abound-workbench-backup-${stamp}.json`, { type: "application/json" });
  return { file, counts };
}

export async function readBackup(f: File): Promise<BackupFile> {
  const data = JSON.parse(await f.text()) as BackupFile;
  if (data?.app !== "abound-workbench" || !data.collections) throw new Error("not a backup");
  return data;
}

/** 把备份写回资料库：同 ID 的资料换成备份的版本，备份之后新增的资料保留不动 */
export async function restoreBackup(data: BackupFile, onProgress?: (done: number, total: number) => void): Promise<number> {
  const entries: [string, string, Record<string, unknown>][] = [];
  for (const c of BACKUP_COLLECTIONS) for (const [id, v] of Object.entries(data.collections[c] || {})) entries.push([c, id, v]);
  let done = 0;
  let batch = writeBatch(db());
  let n = 0;
  let bytes = 0;
  const flush = async () => {
    if (!n) return;
    await batch.commit();
    batch = writeBatch(db());
    n = 0;
    bytes = 0;
  };
  for (const [c, id, v] of entries) {
    const size = JSON.stringify(v).length;
    // 图片很大：单独写入；其他资料每批最多 400 笔 / 约 4MB
    if (size > 500000) {
      await setDoc(doc(db(), c, id), v);
    } else {
      if (n >= 400 || bytes + size > 4000000) await flush();
      batch.set(doc(db(), c, id), v);
      n++;
      bytes += size;
    }
    done++;
    if (done % 20 === 0) onProgress?.(done, entries.length);
  }
  await flush();
  onProgress?.(entries.length, entries.length);
  return entries.length;
}
