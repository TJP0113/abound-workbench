// 本地预览用的假资料库（只在 DEMO=1 时启用，不会进入正式网站）
type Data = Record<string, unknown>;
type Listener = () => void;

const DELETE = { __delete: true };
export const store: Record<string, Map<string, Data>> = {};
const listeners = new Set<Listener>();
let seq = 0;

export function col(name: string) {
  if (!store[name]) store[name] = new Map();
  return store[name];
}
export function newId() {
  seq += 1;
  return `demo${Date.now().toString(36)}${seq}`;
}
export function emit() {
  setTimeout(() => listeners.forEach((l) => l()), 0);
}
export function listen(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function deleteSentinel() {
  return DELETE;
}
export function applyPatch(target: Data, patch: Data) {
  for (const [k, v] of Object.entries(patch)) {
    const path = k.split(".");
    let o = target as Data;
    for (const p of path.slice(0, -1)) {
      if (typeof o[p] !== "object" || o[p] === null) o[p] = {};
      o = o[p] as Data;
    }
    const last = path[path.length - 1];
    if (v === DELETE) delete o[last];
    else o[last] = JSON.parse(JSON.stringify(v));
  }
}
