import { adminDb } from "@/lib/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return email ? "(格式不对 / invalid format)" : "";
  return `${u.slice(0, 2)}***@${d}`;
}

/** 设定检查：只显示各项设定是否正常，不会显示任何密钥 */
export async function GET() {
  const checks: Record<string, string> = {};
  const env = (k: string) => (process.env[k] || "").trim();

  for (const k of [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "CRON_SECRET",
  ])
    checks[k] = env(k) ? "OK" : "MISSING";

  const admin = env("ADMIN_EMAIL").toLowerCase();
  checks.ADMIN_EMAIL = admin ? `OK (${mask(admin)})` : "MISSING";
  checks.APP_URL = env("APP_URL") ? `OK (${env("APP_URL")})` : "MISSING";

  const raw = env("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) checks.FIREBASE_SERVICE_ACCOUNT = "MISSING";
  else {
    try {
      const sa = JSON.parse(raw);
      checks.FIREBASE_SERVICE_ACCOUNT =
        sa.project_id === env("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
          ? `OK (project: ${sa.project_id})`
          : `PROJECT MISMATCH (json: ${sa.project_id}, config: ${env("NEXT_PUBLIC_FIREBASE_PROJECT_ID")})`;
    } catch {
      checks.FIREBASE_SERVICE_ACCOUNT = "INVALID JSON — 请重新贴上整个 .json 文件内容";
    }
  }

  try {
    const snap = await adminDb().collection("members").limit(20).get();
    checks.DATABASE = `OK (${snap.size} member(s))`;
    if (admin) checks.ADMIN_IN_LIST = snap.docs.some((d) => d.id === admin) ? "YES" : "NO";
  } catch (e) {
    checks.DATABASE = `ERROR: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`;
  }

  return Response.json(checks);
}
