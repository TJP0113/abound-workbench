import "server-only";
import { adminDb } from "./admin";
import { nextDue } from "../routine";
import { todayStr } from "../dates";
import type { Task } from "../types";

/** 为已完成、会重复、还没建立下一次的日常事务建立下一次 */
export async function spawnRoutines(): Promise<number> {
  const db = adminDb();
  const snap = await db.collection("tasks").where("kind", "==", "routine").where("status", "==", "done").get();
  const today = todayStr();
  let n = 0;
  for (const d of snap.docs) {
    const t = d.data() as Task;
    if (t.spawnedNext || !t.repeat || t.repeat === "none") continue;
    const due = nextDue(t.due, t.repeat, today);
    if (!due) continue;
    const next: Omit<Task, "id"> = {
      kind: "routine",
      repeat: t.repeat,
      projectId: "",
      projectName: "",
      title: t.title,
      description: t.description ?? "",
      assigneeEmails: t.assigneeEmails,
      memberEmails: t.memberEmails,
      due,
      priority: t.priority,
      status: "todo",
      subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })),
      note: t.note ?? "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const batch = db.batch();
    batch.set(db.collection("tasks").doc(), next);
    batch.update(d.ref, { spawnedNext: true });
    await batch.commit();
    n++;
  }
  return n;
}
