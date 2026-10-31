import { jsonError, requireMember } from "@/lib/server/admin";
import { disconnect } from "@/lib/server/gcal";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireMember(req, { admin: true });
    await disconnect();
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
