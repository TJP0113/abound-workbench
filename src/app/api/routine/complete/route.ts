import { adminDb, HttpError, jsonError, requireMember } from "@/lib/server/admin";
import { spawnRoutines } from "@/lib/server/routine";
import type { Task } from "@/lib/types";

export const runtime = "nodejs";

/** 日常事务：负责人或管理员直接标为完成（不用审核），并建立下一次 */
export async function POST(req: Request) {
  try {
    const m = await requireMember(req);
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) throw new HttpError(400, "missing id");
    const ref = adminDb().collection("tasks").doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "not found");
    const t = snap.data() as Task;
    if (t.kind !== "routine") throw new HttpError(400, "not a routine task");
    if (m.role !== "admin" && !t.assigneeEmails.includes(m.email)) throw new HttpError(403, "not assignee");
    await ref.update({ status: "done", updatedAt: Date.now() });
    const spawned = await spawnRoutines();
    return Response.json({ ok: true, spawned });
  } catch (e) {
    return jsonError(e);
  }
}
