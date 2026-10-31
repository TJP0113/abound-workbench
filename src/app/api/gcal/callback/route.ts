import { adminDb } from "@/lib/server/admin";
import { appUrl, completeConnection, syncCalendar } from "@/lib/server/gcal";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const back = (result: string) => Response.redirect(`${appUrl()}/settings?gcal=${result}`, 302);
  if (!code || !state) return back("cancelled");
  try {
    const ref = adminDb().collection("settings").doc("oauthState");
    const snap = await ref.get();
    const saved = snap.data() as { state?: string; expires?: number } | undefined;
    await ref.delete();
    if (!saved?.state || saved.state !== state || (saved.expires ?? 0) < Date.now()) return back("expired");
    await completeConnection(code);
    await syncCalendar().catch((e) => console.error("[gcal] first sync", e));
    return back("ok");
  } catch (e) {
    console.error("[gcal] callback", e);
    return back("error");
  }
}
