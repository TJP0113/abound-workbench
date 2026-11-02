export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return email ? "(格式不对 / invalid format)" : "";
  return `${u.slice(0, 2)}***@${d}`;
}

/** 设定检查：只显示各项设定是否正常，不会显示任何密钥 */
export async function GET(req: Request) {
  // 需要加上 ?key=CRON_SECRET 才能查看，避免外人看到设定状态
  const key = new URL(req.url).searchParams.get("key") || "";
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret || key !== secret) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return await run();
  } catch (e) {
    return Response.json({ FATAL: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 500) : String(e) }, { status: 200 });
  }
}

async function run() {
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

  // OAuth 客户端检查：格式，以及是否属于同一个 Google Cloud 项目（编号要和 Firebase appId 里的一致）
  const cid = env("GOOGLE_CLIENT_ID");
  if (cid) {
    const num = cid.split("-")[0];
    const appNum = env("NEXT_PUBLIC_FIREBASE_APP_ID").split(":")[1] || "";
    // Client ID 本来就会出现在 Google 授权网址里，不是机密，直接显示以便核对
    if (!cid.endsWith(".apps.googleusercontent.com"))
      checks.GOOGLE_CLIENT_ID = `WRONG FORMAT（应以 .apps.googleusercontent.com 结尾）现在的值：[${cid.length > 120 ? cid.slice(0, 120) + "…" : cid}]`;
    else if (appNum && num !== appNum) checks.GOOGLE_CLIENT_ID = `WRONG PROJECT（客户端属于项目 ${num}，Firebase 是 ${appNum}）`;
    else checks.GOOGLE_CLIENT_ID = `OK (${num}-…${cid.slice(-30)})`;
  }
  const sec = env("GOOGLE_CLIENT_SECRET");
  if (sec) checks.GOOGLE_CLIENT_SECRET = sec.startsWith("GOCSPX-") ? `OK (长度 ${sec.length})` : `可能不对（通常以 GOCSPX- 开头，长度 ${sec.length}）`;

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
    const { adminDb } = await import("@/lib/server/admin");
    const snap = await adminDb().collection("members").limit(20).get();
    checks.DATABASE = `OK (${snap.size} member(s))`;
    if (admin) checks.ADMIN_IN_LIST = snap.docs.some((d) => d.id === admin) ? "YES" : "NO";
  } catch (e) {
    checks.DATABASE = `ERROR: ${e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 400) : String(e)}`;
  }

  return Response.json(checks);
}
