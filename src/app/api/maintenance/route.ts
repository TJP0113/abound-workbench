import { jsonError, requireMember } from "@/lib/server/admin";
import { migrateSocialStageOrder, runSocialCycles, purgeTrash } from "@/lib/server/maintenance";
import { spawnRoutines } from "@/lib/server/routine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireMember(req);
    const migrated = await migrateSocialStageOrder();
    const social = await runSocialCycles();
    const routines = await spawnRoutines();
    const purged = await purgeTrash().catch(() => -1);
    return Response.json({ ...social, routines, migrated, purged });
  } catch (e) {
    return jsonError(e);
  }
}
