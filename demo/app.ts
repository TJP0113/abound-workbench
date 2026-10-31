export function initializeApp() {
  return { name: "demo" };
}
export function getApps() {
  return [{ name: "demo" }];
}
export type FirebaseApp = { name: string };
