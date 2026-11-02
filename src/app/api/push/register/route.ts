import { adminDb, jsonError, requireMember } from "@/lib/server/admin";

export const runtime = "nodejs";

/** 登记这台电脑 / 手机的推送凭证 */
export async function POST(req: Request) {
  try {
    const m = await requireMember(req);
    const { token, device } = (await req.json().catch(() => ({}))) as { token?: string; device?: string };
    if (!token || token.length < 20 || token.length > 4096 || token.includes("/")) return Response.json({ error: "bad token" }, { status: 400 });
    await adminDb()
      .collection("pushTokens")
      .doc(token)
      .set({ email: m.email, device: (device || "").slice(0, 200), updatedAt: Date.now() });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
