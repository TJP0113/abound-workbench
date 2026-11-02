import { jsonError, requireMember } from "@/lib/server/admin";
import { runSocialCycles } from "@/lib/server/maintenance";
import { spawnRoutines } from "@/lib/server/routine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireMember(req);
    const social = await runSocialCycles();
    const routines = await spawnRoutines();
    return Response.json({ ...social, routines });
  } catch (e) {
    return jsonError(e);
  }
}
