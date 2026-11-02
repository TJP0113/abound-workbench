import { adminDb, jsonError, requireMember } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const m = await requireMember(req);
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (token && !token.includes("/")) {
      const ref = adminDb().collection("pushTokens").doc(token);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.email === m.email) await ref.delete();
    }
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
