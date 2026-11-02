"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import type { OrderForm } from "./orderform";
import { useAuth } from "@/components/AuthProvider";

/** 订阅某个项目的 Order Form */
export function useOrderForms(projectId: string): OrderForm[] {
  const { isAdmin, member } = useAuth();
  const [list, setList] = useState<OrderForm[]>([]);
  useEffect(() => {
    if (!member) return;
    const base = collection(db(), "orderForms");
    // 员工的查询必须带上自己的邮箱，才符合权限规则
    const q = isAdmin
      ? query(base, where("projectId", "==", projectId))
      : query(base, where("projectId", "==", projectId), where("memberEmails", "array-contains", member.email));
    return onSnapshot(
      q,
      (snap) =>
        setList(
          snap.docs
            .map((d) => ({ ...(d.data() as OrderForm), id: d.id }))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        ),
      (e) => console.error("[orderForms]", e)
    );
  }, [projectId, isAdmin, member]);
  return list;
}

function clean<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export async function saveOrderForm(f: Omit<OrderForm, "id">, id?: string): Promise<string> {
  const data = clean({ ...f, updatedAt: Date.now() });
  if (id) {
    await setDoc(doc(db(), "orderForms", id), data);
    return id;
  }
  const ref = await addDoc(collection(db(), "orderForms"), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function deleteOrderForm(f: OrderForm): Promise<void> {
  const ids = [f.frontImage, f.backImage, ...(f.images || []).map((i) => i.id)].filter(Boolean) as string[];
  for (const id of ids) await deleteDoc(doc(db(), "orderImages", id)).catch(() => {});
  await deleteDoc(doc(db(), "orderForms", f.id));
}

export async function uploadOrderImage(data: string, projectId: string, memberEmails: string[]): Promise<string> {
  const ref = await addDoc(collection(db(), "orderImages"), { data, projectId, memberEmails, createdAt: Date.now() });
  return ref.id;
}

export async function deleteOrderImage(id: string): Promise<void> {
  await deleteDoc(doc(db(), "orderImages", id)).catch(() => {});
}

const cache = new Map<string, string>();

export async function loadOrderImage(id: string): Promise<string> {
  if (cache.has(id)) return cache.get(id)!;
  const snap = await getDoc(doc(db(), "orderImages", id));
  const data = (snap.data()?.data as string) || "";
  if (data) cache.set(id, data);
  return data;
}

export function useOrderImage(id?: string): string {
  const [src, setSrc] = useState(id ? cache.get(id) || "" : "");
  useEffect(() => {
    if (!id) {
      setSrc("");
      return;
    }
    let alive = true;
    loadOrderImage(id).then((d) => alive && setSrc(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return src;
}
