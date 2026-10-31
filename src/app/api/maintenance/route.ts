import { jsonError, requireMember } from "@/lib/server/admin";
import { runSocialCycles } from "@/lib/server/maintenance";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireMember(req);
    return Response.json(await runSocialCycles());
  } catch (e) {
    return jsonError(e);
  }
}
