"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface GcalStatus {
  connected: boolean;
  email?: string | null;
  calendarName?: string;
  lastSync?: number | null;
  error?: string;
}

export function useGcalStatus(): GcalStatus | null {
  const [s, setS] = useState<GcalStatus | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db(), "settings", "gcalPublic"),
        (snap) => setS((snap.data() as GcalStatus) ?? { connected: false }),
        () => setS({ connected: false })
      ),
    []
  );
  return s;
}
