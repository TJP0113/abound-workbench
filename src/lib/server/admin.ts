import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { Member } from "../types";

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const sa = JSON.parse(raw);
  if (typeof sa.private_key === "string") sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  app = initializeApp({ credential: cert(sa) });
  return app;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** 验证请求者：必须登录，且在员工名单内并已启用 */
export async function requireMember(req: Request, opts?: { admin?: boolean }): Promise<Member> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Not signed in");
  let email = "";
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    email = (decoded.email || "").toLowerCase();
    if (!email || !decoded.email_verified) throw new Error("no email");
  } catch {
    throw new HttpError(401, "Invalid token");
  }
  const snap = await adminDb().collection("members").doc(email).get();
  if (!snap.exists) throw new HttpError(403, "Not authorised");
  const m = { ...(snap.data() as Member), email };
  if (!m.active) throw new HttpError(403, "Deactivated");
  if (opts?.admin && m.role !== "admin") throw new HttpError(403, "Admins only");
  return m;
}

export async function verifyEmailOnly(req: Request): Promise<string> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Not signed in");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
  if (!decoded.email || !decoded.email_verified) throw new HttpError(401, "No verified email");
  return decoded.email.toLowerCase();
}

export function jsonError(e: unknown): Response {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Server error";
  if (status === 500) console.error(e);
  return Response.json({ error: message }, { status });
}
