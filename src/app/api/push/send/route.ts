import { adminDb, jsonError, requireMember } from "@/lib/server/admin";
import { pushNotifications } from "@/lib/server/push";
import type { AppNotification } from "@/lib/types";

export const runtime = "nodejs";

/** 站内通知建立后，推送到对方的电脑 / 手机。只能推送自己刚发出的通知 */
export async function POST(req: Request) {
  try {
    const m = await requireMember(req);
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
    if (!Array.isArray(ids) || !ids.length) return Response.json({ sent: 0 });
    const db = adminDb();
    const docs = await Promise.all(ids.slice(0, 50).map((id) => db.collection("notifications").doc(String(id)).get()));
    const list = docs
      .filter((d) => d.exists)
      .map((d) => d.data() as Omit<AppNotification, "id">)
      .filter((n) => n.fromEmail === m.email && Date.now() - n.createdAt < 5 * 60 * 1000);
    const sent = await pushNotifications(list);
    return Response.json({ sent });
  } catch (e) {
    return jsonError(e);
  }
}
