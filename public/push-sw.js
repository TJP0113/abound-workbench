// ABOUND 工作台 — 推送通知（Service Worker）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { body: event.data ? event.data.text() : "" } };
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  const link =
    (payload.fcmOptions && payload.fcmOptions.link) || n.click_action || (data.link ? self.location.origin + data.link : "/");
  const title = n.title || data.title || "ABOUND 工作台";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: n.body || data.body || "",
      icon: n.icon || "/icon-192.png",
      badge: n.badge || "/badge-72.png",
      tag: n.tag || undefined,
      data: { link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(link).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
