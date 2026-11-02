import "server-only";
import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { adminDb } from "./admin";
import { appUrl } from "./url";
import type { AppNotification, Lang } from "../types";

const TITLE: Record<Lang, string> = { zh: "ABOUND 工作台", en: "ABOUND Studio Desk" };

/** 把站内通知同时推送到该员工已开启通知的电脑 / 手机 */
export async function pushNotifications(list: Omit<AppNotification, "id">[]): Promise<number> {
  if (!list.length) return 0;
  const db = adminDb(); // 确保 firebase-admin 已初始化
  const messaging = getMessaging(getApps()[0]);
  const emails = Array.from(new Set(list.map((n) => n.toEmail)));
  let sent = 0;

  for (const email of emails) {
    const [tokSnap, mSnap] = await Promise.all([
      db.collection("pushTokens").where("email", "==", email).get(),
      db.collection("members").doc(email).get(),
    ]);
    if (tokSnap.empty) continue;
    const lang: Lang = (mSnap.data()?.lang as Lang) === "en" ? "en" : "zh";
    const tokens = tokSnap.docs.map((d) => d.id);

    for (const n of list.filter((x) => x.toEmail === email)) {
      const body = lang === "en" ? n.textEn : n.text;
      const res = await messaging.sendEachForMulticast({
        tokens,
        webpush: {
          notification: {
            title: TITLE[lang],
            body,
            icon: "/icon-192.png",
            badge: "/badge-72.png",
            tag: `${n.type}-${n.createdAt}`,
          },
          fcmOptions: { link: `${appUrl()}${n.link}` },
        },
        data: { link: n.link },
      });
      sent += res.successCount;
      // 清除失效的装置
      const dead = res.responses
        .map((r, i) => (!r.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(r.error?.code || "") ? tokens[i] : null))
        .filter(Boolean) as string[];
      for (const tkn of dead) await db.collection("pushTokens").doc(tkn).delete().catch(() => {});
    }
  }
  return sent;
}
