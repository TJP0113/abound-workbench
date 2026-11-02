"use client";

import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { getApp } from "./firebase";

const VAPID = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "").trim();
const SW_URL = "/push-sw.js";
const DONE_KEY = "abound.push";

export type PushState =
  | "checking"
  | "unsupported" // 浏览器不支持
  | "ios-install" // iPhone / iPad：要先加到主画面
  | "not-configured" // 管理员还没设定推送钥匙
  | "denied" // 使用者拒绝了通知权限
  | "off" // 可以开启
  | "on"; // 这台装置已开启

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}
function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
function readFlag(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(DONE_KEY, "1");
    else localStorage.removeItem(DONE_KEY);
  } catch {
    /* 忽略 */
  }
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "checking";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return "unsupported";
  if (!VAPID) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted" && readFlag()) return "on";
  return "off";
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${os} · ${br}`;
}

async function currentToken(): Promise<string> {
  const reg = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(getApp()), { vapidKey: VAPID, serviceWorkerRegistration: reg });
}

type Api = <T = unknown>(path: string, body?: unknown) => Promise<T>;

/** 开启这台装置的推送（要在使用者点击按钮时呼叫） */
export async function enablePush(api: Api): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const token = await currentToken();
  await api("/api/push/register", { token, device: deviceName() });
  writeFlag(true);
  return "on";
}

export async function disablePush(api: Api): Promise<PushState> {
  try {
    const token = await currentToken();
    await api("/api/push/unregister", { token });
    await deleteToken(getMessaging(getApp()));
  } catch {
    /* 忽略 */
  }
  writeFlag(false);
  return "off";
}

/** 每次打开工作台时更新凭证（凭证可能会过期更换） */
export async function refreshPush(api: Api): Promise<void> {
  if ((await pushState()) !== "on") return;
  try {
    const token = await currentToken();
    await api("/api/push/register", { token, device: deviceName() });
  } catch {
    /* 忽略 */
  }
}

/** 测试：送一则通知给自己 */
export async function testPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  await reg?.showNotification("ABOUND 工作台", { body: "通知已开启 · Notifications are on", icon: "/icon-192.png", badge: "/badge-72.png" });
}
