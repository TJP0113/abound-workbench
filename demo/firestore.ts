import { applyPatch, col, deleteSentinel, emit, listen, newId } from "./store";
import "./seed";

type Data = Record<string, unknown>;
type DocRef = { kind: "doc"; col: string; id: string };
type ColRef = { kind: "col"; col: string };
type Where = { f: string; op: string; v: unknown };
type Query = { kind: "query"; col: string; wheres: Where[] };
export type Firestore = { demo: true };

export function getFirestore(): Firestore {
  return { demo: true };
}
export function collection(_db: unknown, name: string): ColRef {
  return { kind: "col", col: name };
}
export function doc(a: unknown, name?: string, id?: string): DocRef {
  if ((a as ColRef)?.kind === "col") return { kind: "doc", col: (a as ColRef).col, id: newId() };
  return { kind: "doc", col: name!, id: id! };
}
export function where(f: string, op: string, v: unknown): Where {
  return { f, op, v };
}
export function query(c: ColRef, ...wheres: Where[]): Query {
  return { kind: "query", col: c.col, wheres };
}
export function deleteField() {
  return deleteSentinel();
}

function match(d: Data, w: Where) {
  const val = d[w.f];
  if (w.op === "==") return val === w.v;
  if (w.op === "array-contains") return Array.isArray(val) && val.includes(w.v);
  return true;
}
function snapDoc(c: string, id: string) {
  const data = col(c).get(id);
  return { id, exists: () => !!data, data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined), ref: { kind: "doc", col: c, id } as DocRef };
}
function run(q: ColRef | Query) {
  const wheres = q.kind === "query" ? q.wheres : [];
  const docs = [...col(q.col).entries()].filter(([, d]) => wheres.every((w) => match(d, w))).map(([id]) => snapDoc(q.col, id));
  return { docs, forEach: (fn: (d: ReturnType<typeof snapDoc>) => void) => docs.forEach(fn) };
}

export function onSnapshot(ref: DocRef | ColRef | Query, next: (s: unknown) => void) {
  const fire = () => next(ref.kind === "doc" ? snapDoc(ref.col, ref.id) : run(ref));
  setTimeout(fire, 0);
  return listen(fire);
}
export async function getDocs(q: ColRef | Query) {
  return run(q);
}
export async function addDoc(c: ColRef, data: Data) {
  const id = newId();
  col(c.col).set(id, JSON.parse(JSON.stringify(data)));
  emit();
  return { id };
}
export async function setDoc(r: DocRef, data: Data, opts?: { merge?: boolean }) {
  const prev = opts?.merge ? col(r.col).get(r.id) ?? {} : {};
  const next = { ...prev };
  applyPatch(next, data);
  col(r.col).set(r.id, next);
  emit();
}
export async function updateDoc(r: DocRef, data: Data) {
  const prev = col(r.col).get(r.id);
  if (!prev) throw new Error("not found");
  applyPatch(prev, data);
  emit();
}
export async function deleteDoc(r: DocRef) {
  col(r.col).delete(r.id);
  emit();
}
export function writeBatch() {
  const ops: (() => void)[] = [];
  return {
    set: (r: DocRef, d: Data) => ops.push(() => col(r.col).set(r.id, JSON.parse(JSON.stringify(d)))),
    update: (r: DocRef, d: Data) => ops.push(() => applyPatch(col(r.col).get(r.id) ?? {}, d)),
    delete: (r: DocRef) => ops.push(() => col(r.col).delete(r.id)),
    commit: async () => {
      ops.forEach((o) => o());
      emit();
    },
  };
}
