import { randomBytes } from "crypto";
import { adminDb, jsonError, requireMember } from "@/lib/server/admin";
import { authUrl } from "@/lib/server/gcal";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireMember(req, { admin: true });
    const state = randomBytes(24).toString("hex");
    await adminDb().collection("settings").doc("oauthState").set({ state, expires: Date.now() + 10 * 60 * 1000 });
    return Response.json({ url: authUrl(state) });
  } catch (e) {
    return jsonError(e);
  }
}
