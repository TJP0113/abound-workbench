import "./seed";

export type User = { email: string; getIdToken: () => Promise<string> };
export type Auth = { currentUser: User | null };

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const who = (typeof window !== "undefined" && (params?.get("as") || localStorage.getItem("demo.as"))) || "jp@abound.test";
if (typeof window !== "undefined" && params?.get("as")) localStorage.setItem("demo.as", params.get("as")!);

const user: User = { email: who, getIdToken: async () => "demo" };
const auth: Auth = { currentUser: user };

export function getAuth() {
  return auth;
}
export class GoogleAuthProvider {
  setCustomParameters() {}
}
export function onAuthStateChanged(_a: Auth, cb: (u: User | null) => void) {
  setTimeout(() => cb(auth.currentUser), 0);
  return () => {};
}
export async function signInWithPopup() {
  return { user };
}
export async function signOut() {
  auth.currentUser = null;
}
