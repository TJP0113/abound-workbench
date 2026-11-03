import "server-only";
import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { OAuth2Client } from "google-auth-library";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import { appUrl } from "./url";
export { appUrl };
import { EVENT_COLORS } from "../services";
import { addDays, TIMEZONE, todayStr } from "../dates";
import type { CalEvent, EventType, Project, Task } from "../types";

export const CALENDAR_NAME = "ABOUND CREATION 工作台";
const SCOPES = ["https://www.googleapis.com/auth/calendar", "openid", "email"];

interface GcalSettings {
  refreshToken?: string;
  email?: string;
  calendarId?: string;
  syncToken?: string | null;
  lockUntil?: number;
}


export function oauthClient(): OAuth2Client {
  const id = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const secret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return new OAuth2Client({ clientId: id, clientSecret: secret, redirectUri: `${appUrl()}/api/gcal/callback` });
}

export function authUrl(state: string): string {
  return oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state, include_granted_scopes: true });
}

const settingsRef = () => adminDb().collection("settings").doc("gcal");
const publicRef = () => adminDb().collection("settings").doc("gcalPublic");
const mapCol = () => adminDb().collection("gcalMap");

async function readSettings(): Promise<GcalSettings> {
  const s = await settingsRef().get();
  return (s.data() as GcalSettings) || {};
}

function clientFor(refreshToken: string): calendar_v3.Calendar {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return calendar({ version: "v3", auth });
}

/** OAuth 回调：保存授权，找到或建立工作室日历 */
export async function completeConnection(code: string): Promise<void> {
  const auth = oauthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh token returned. Remove the app's access in your Google account and try again.");
  auth.setCredentials(tokens);
  let email = "";
  if (tokens.id_token) {
    const ticket = await auth.verifyIdToken({ idToken: tokens.id_token, audience: (process.env.GOOGLE_CLIENT_ID || "").trim() });
    email = ticket.getPayload()?.email || "";
  }
  const cal = calendar({ version: "v3", auth });
  const list = await cal.calendarList.list({ maxResults: 250 });
  let calendarId = list.data.items?.find((c) => c.summary === CALENDAR_NAME && c.accessRole === "owner")?.id || "";
  if (!calendarId) {
    const created = await cal.calendars.insert({ requestBody: { summary: CALENDAR_NAME, timeZone: TIMEZONE } });
    calendarId = created.data.id || "";
  }
  // 换了日历：清除旧对照
  const prev = await readSettings();
  if (prev.calendarId !== calendarId) await clearMap();
  await settingsRef().set({ refreshToken: tokens.refresh_token, email, calendarId, syncToken: null, lockUntil: 0, connectedAt: Date.now() });
  await publicRef().set({ connected: true, email, calendarName: CALENDAR_NAME, lastSync: null });
}

async function clearMap() {
  const snap = await mapCol().get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = adminDb().batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function disconnect(): Promise<void> {
  const s = await readSettings();
  if (s.refreshToken) await oauthClient().revokeToken(s.refreshToken).catch(() => {});
  await settingsRef().delete();
  await clearMap();
  await publicRef().set({ connected: false, email: null, lastSync: null });
}

// ---------------- 工作台资料 → Google 活动 ----------------

type Desired = { key: string; body: calendar_v3.Schema$Event; hash: string };

function allDay(date: string, endDate?: string) {
  return { start: { date }, end: { date: addDays(endDate && endDate >= date ? endDate : date, 1) } };
}

function bodyFor(
  key: string,
  summary: string,
  type: EventType,
  time: { start: calendar_v3.Schema$EventDateTime; end: calendar_v3.Schema$EventDateTime },
  description: string,
  location?: string
): Desired {
  const body: calendar_v3.Schema$Event = {
    summary,
    description,
    location: location || undefined,
    colorId: EVENT_COLORS[type].gcal,
    ...time,
    extendedProperties: { private: { aboundRef: key } },
  };
  const hash = JSON.stringify([summary, description, location || "", body.colorId, time.start, time.end]);
  return { key, body, hash };
}

async function buildDesired(): Promise<Desired[]> {
  const db = adminDb();
  const [projects, tasks, events, members] = await Promise.all([
    db.collection("projects").get(),
    db.collection("tasks").get(),
    db.collection("events").get(),
    db.collection("members").get(),
  ]);
  const names = new Map(members.docs.map((d) => [d.id, (d.data().name as string) || d.id]));
  const nm = (emails: string[] = []) => emails.map((e) => names.get(e) || e).join("、");
  const link = (path: string) => `${appUrl()}${path}`;
  const out: Desired[] = [];

  const trashed = new Set(projects.docs.filter((d) => (d.data() as Project).deletedAt).map((d) => d.id));
  for (const d of projects.docs) {
    const p = d.data() as Project;
    if (p.status === "cancelled" || p.deletedAt) continue;
    const label = p.client ? `${p.name}（${p.client}）` : p.name;
    const desc = `负责人：${nm([p.ownerEmail])}\n${link(`/projects/${d.id}`)}`;
    if (p.dueDate && p.status !== "done") out.push(bodyFor(`p_${d.id}`, `交货 · ${label}`, "delivery", allDay(p.dueDate), desc));
    const o = p.outsourcing;
    if (o?.vendorEta && p.status !== "done")
      out.push(bodyFor(`pv_${d.id}`, `预计送货 · ${o.vendorName || "服装厂商"} · ${p.name}`, "deadline", allDay(o.vendorEta), desc));
    if (o?.printerEta && p.status !== "done")
      out.push(bodyFor(`pp_${d.id}`, `印刷预计完成 · ${o.printerName || "印刷厂"} · ${p.name}`, "deadline", allDay(o.printerEta), desc));
  }

  for (const d of tasks.docs) {
    const t = d.data() as Task;
    if (t.status === "done" || !t.due || (t.projectId && trashed.has(t.projectId))) continue;
    out.push(
      bodyFor(
        `t_${d.id}`,
        t.projectName ? `截止 · ${t.title} · ${t.projectName}` : `截止 · ${t.title}`,
        "deadline",
        allDay(t.due),
        `负责人：${nm(t.assigneeEmails)}\n${link(`/tasks?task=${d.id}`)}`
      )
    );
  }

  for (const d of events.docs) {
    const e = d.data() as CalEvent;
    if (!e.date) continue;
    const time =
      e.allDay || !e.startTime
        ? allDay(e.date, e.endDate)
        : {
            start: { dateTime: `${e.date}T${e.startTime}:00`, timeZone: TIMEZONE },
            end: { dateTime: `${e.endDate || e.date}T${e.endTime || e.startTime}:00`, timeZone: TIMEZONE },
          };
    const who = e.attendeeEmails?.length ? `参与：${nm(e.attendeeEmails)}\n` : "";
    out.push(bodyFor(`e_${d.id}`, e.title, e.type, time, `${who}${link("/calendar")}`, e.location));
  }
  return out;
}

// ---------------- Google → 工作台 ----------------

function localParts(dt: calendar_v3.Schema$EventDateTime | undefined): { date: string; time?: string } | null {
  if (!dt) return null;
  if (dt.date) return { date: dt.date };
  if (!dt.dateTime) return null;
  const d = new Date(dt.dateTime);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const hour = g("hour") === "24" ? "00" : g("hour");
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${hour}:${g("minute")}` };
}

function typeFromColor(colorId?: string | null): EventType {
  const hit = (Object.keys(EVENT_COLORS) as EventType[]).find((k) => EVENT_COLORS[k].gcal === colorId);
  return hit === "meeting" || hit === "internal" ? hit : "meeting";
}

interface MapEntry {
  eventId: string;
  hash: string;
  etag?: string;
}

async function pull(cal: calendar_v3.Calendar, s: GcalSettings, map: Map<string, MapEntry>): Promise<number> {
  const db = adminDb();
  const byEventId = new Map<string, string>();
  map.forEach((v, k) => byEventId.set(v.eventId, k));
  let pageToken: string | undefined;
  let syncToken = s.syncToken || undefined;
  let nextSyncToken: string | undefined;
  let changed = 0;
  const items: calendar_v3.Schema$Event[] = [];
  const initial = !syncToken;
  try {
    do {
      const res = await cal.events.list({
        calendarId: s.calendarId!,
        maxResults: 250,
        pageToken,
        syncToken,
        singleEvents: true,
      });
      items.push(...(res.data.items || []));
      pageToken = res.data.nextPageToken || undefined;
      nextSyncToken = res.data.nextSyncToken || nextSyncToken;
    } while (pageToken);
  } catch (e) {
    if ((e as { code?: number }).code === 410) {
      await settingsRef().update({ syncToken: null });
      return 0;
    }
    throw e;
  }

  for (const it of items) {
    if (!it.id) continue;
    const key = it.extendedProperties?.private?.aboundRef || byEventId.get(it.id);
    const entry = key ? map.get(key) : undefined;
    if (entry && entry.etag && entry.etag === it.etag) continue; // 自己写入的改动
    if (initial) {
      // 第一次完整读取：不覆盖工作台资料；认领已带标记、但对照表里没有的活动，避免重复建立
      if (key && !entry) {
        const e2: MapEntry = { eventId: it.id, hash: "" };
        await mapCol().doc(key).set(e2);
        map.set(key, e2);
      }
      if (key) continue;
    }

    if (it.status === "cancelled") {
      if (!key) continue;
      if (key.startsWith("e_")) await db.collection("events").doc(key.slice(2)).delete().catch(() => {});
      await mapCol().doc(key).delete();
      map.delete(key);
      changed++;
      continue;
    }

    const start = localParts(it.start);
    const endRaw = localParts(it.end);
    if (!start) continue;
    const isAllDay = !!it.start?.date;
    const endDate = endRaw ? (isAllDay ? addDays(endRaw.date, -1) : endRaw.date) : start.date;

    if (!key) {
      // 在 Google Calendar 直接新建的活动
      const ref = db.collection("events").doc();
      const ev: Omit<CalEvent, "id"> = {
        title: it.summary || "(无标题)",
        type: typeFromColor(it.colorId),
        date: start.date,
        endDate: endDate > start.date ? endDate : undefined,
        allDay: isAllDay,
        startTime: isAllDay ? undefined : start.time,
        endTime: isAllDay ? undefined : endRaw?.time,
        attendeeEmails: [],
        location: it.location || undefined,
        source: "google",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ref.set(JSON.parse(JSON.stringify(ev)));
      const newKey = `e_${ref.id}`;
      const patched = await cal.events.patch({
        calendarId: s.calendarId!,
        eventId: it.id,
        requestBody: { extendedProperties: { private: { aboundRef: newKey } } },
      });
      const e2: MapEntry = { eventId: it.id, hash: "", etag: patched.data.etag || undefined };
      await mapCol().doc(newKey).set(e2);
      map.set(newKey, e2);
      changed++;
      continue;
    }

    const id = key.replace(/^(p|pv|pp|t|e)_/, "");
    if (key.startsWith("e_")) {
      await db
        .collection("events")
        .doc(id)
        .set(
          {
            title: it.summary || "(无标题)",
            date: start.date,
            endDate: endDate > start.date ? endDate : FieldValue.delete(),
            allDay: isAllDay,
            startTime: isAllDay ? FieldValue.delete() : start.time,
            endTime: isAllDay ? FieldValue.delete() : endRaw?.time || start.time,
            location: it.location || FieldValue.delete(),
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch(() => {});
    } else if (key.startsWith("p_")) {
      await db.collection("projects").doc(id).update({ dueDate: start.date, updatedAt: Date.now() }).catch(() => {});
    } else if (key.startsWith("pv_")) {
      await db.collection("projects").doc(id).update({ "outsourcing.vendorEta": start.date, updatedAt: Date.now() }).catch(() => {});
    } else if (key.startsWith("pp_")) {
      await db.collection("projects").doc(id).update({ "outsourcing.printerEta": start.date, updatedAt: Date.now() }).catch(() => {});
    } else if (key.startsWith("t_")) {
      await db.collection("tasks").doc(id).update({ due: start.date, updatedAt: Date.now() }).catch(() => {});
    }
    // 标记为需要重新写回（统一标题与颜色）
    const e2: MapEntry = { eventId: it.id, hash: "", etag: it.etag || undefined };
    await mapCol().doc(key).set(e2);
    map.set(key, e2);
    changed++;
  }

  if (nextSyncToken) await settingsRef().update({ syncToken: nextSyncToken });
  return changed;
}

async function push(cal: calendar_v3.Calendar, s: GcalSettings, map: Map<string, MapEntry>) {
  const desired = await buildDesired();
  const wanted = new Set(desired.map((d) => d.key));
  let c = 0,
    u = 0,
    d = 0;
  for (const item of desired) {
    const entry = map.get(item.key);
    if (entry && entry.hash === item.hash) continue;
    let res: { data: calendar_v3.Schema$Event } | null = null;
    if (entry) {
      try {
        res = await cal.events.update({ calendarId: s.calendarId!, eventId: entry.eventId, requestBody: item.body });
        u++;
      } catch (e) {
        const code = (e as { code?: number }).code;
        if (code !== 404 && code !== 410) throw e;
      }
    }
    if (!res) {
      res = await cal.events.insert({ calendarId: s.calendarId!, requestBody: item.body });
      c++;
    }
    const e2: MapEntry = { eventId: res.data.id!, hash: item.hash, etag: res.data.etag || undefined };
    await mapCol().doc(item.key).set(e2);
    map.set(item.key, e2);
  }
  for (const [key, entry] of map) {
    if (wanted.has(key)) continue;
    await cal.events.delete({ calendarId: s.calendarId!, eventId: entry.eventId }).catch(() => {});
    await mapCol().doc(key).delete();
    map.delete(key);
    d++;
  }
  return { c, u, d };
}

/** 双向同步。pullOnly 时只读回 Google 的改动 */
export async function syncCalendar(opts?: { pullOnly?: boolean }) {
  const s = await readSettings();
  if (!s.refreshToken || !s.calendarId) return { connected: false };

  // 简单锁：避免多人同时同步
  const now = Date.now();
  const got = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(settingsRef());
    const lock = (snap.data()?.lockUntil as number) || 0;
    if (lock > now) return false;
    tx.update(settingsRef(), { lockUntil: now + 60_000 });
    return true;
  });
  if (!got) return { connected: true, skipped: true };

  try {
    const cal = clientFor(s.refreshToken);
    const mapSnap = await mapCol().get();
    const map = new Map<string, MapEntry>(mapSnap.docs.map((d) => [d.id, d.data() as MapEntry]));
    const p = await pull(cal, s, map);
    // pullOnly：只有读回改动时才写回（统一标题与颜色）
    const r = opts?.pullOnly && p === 0 ? { c: 0, u: 0, d: 0 } : await push(cal, s, map);
    await publicRef().set({ connected: true, email: s.email || null, calendarName: CALENDAR_NAME, lastSync: Date.now() }, { merge: true });
    return { connected: true, pulled: p, created: r.c, updated: r.u, deleted: r.d, today: todayStr() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("invalid_grant")) {
      await publicRef().set({ connected: false, error: "invalid_grant" }, { merge: true });
    }
    throw e;
  } finally {
    await settingsRef().update({ lockUntil: 0 }).catch(() => {});
  }
}
