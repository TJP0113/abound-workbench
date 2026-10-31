import { adminDb, jsonError, verifyEmailOnly } from "@/lib/server/admin";

export const runtime = "nodejs";

/** 第一次登录：员工名单为空且登录者是 ADMIN_EMAIL 时，建立第一位管理员 */
export async function POST(req: Request) {
  try {
    const email = await verifyEmailOnly(req);
    const admin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!admin || email !== admin) return Response.json({ created: false });
    const ref = adminDb().collection("members").doc(email);
    const snap = await ref.get();
    if (snap.exists) return Response.json({ created: false });
    const name = email.split("@")[0];
    await ref.set({ email, name, role: "admin", active: true, title: "", skills: "", lang: "zh" });
    return Response.json({ created: true });
  } catch (e) {
    return jsonError(e);
  }
}
