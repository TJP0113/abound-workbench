import { jsonError } from "@/lib/server/admin";
import { runReminders, runSocialCycles, purgeTrash } from "@/lib/server/maintenance";
import { spawnRoutines } from "@/lib/server/routine";
import { syncCalendar } from "@/lib/server/gcal";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel 每日定时任务（马来西亚时间 00:05） */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const social = await runSocialCycles();
    const routines = await spawnRoutines();
    const reminders = await runReminders();
    const purged = await purgeTrash().catch(() => -1);
    const gcal = await syncCalendar().catch((e) => ({ error: String(e) }));
    return Response.json({ social, routines, reminders, purged, gcal });
  } catch (e) {
    return jsonError(e);
  }
}
