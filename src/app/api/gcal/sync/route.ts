import { jsonError, requireMember } from "@/lib/server/admin";
import { syncCalendar } from "@/lib/server/gcal";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireMember(req);
    const body = (await req.json().catch(() => ({}))) as { pullOnly?: boolean };
    return Response.json(await syncCalendar({ pullOnly: !!body.pullOnly }));
  } catch (e) {
    return jsonError(e);
  }
}
