"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { getQueue, refreshBootstrap, syncOfflineBills } from "@/lib/offline-client";

/**
 * Runs inside the app: saves the offline billing screen and the menu on this device, sends bills
 * made offline to the server, and shows a banner with a way to keep billing when the internet drops.
 */
export function OfflineKeeper() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          await navigator.serviceWorker.ready;
          (reg.active ?? reg.waiting ?? reg.installing)?.postMessage("warm");
        })
        .catch(() => undefined);
    }
    const tick = async () => {
      if (!navigator.onLine) return;
      await refreshBootstrap();
      if (getQueue().length) await syncOfflineBills();
      setWaiting(getQueue().length);
    };
    setOffline(!navigator.onLine);
    setWaiting(getQueue().length);
    tick();
    const t = setInterval(tick, 10 * 60_000);
    const up = () => {
      setOffline(false);
      tick();
    };
    const down = () => setOffline(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (!offline && !waiting) return null;
  return (
    <div className={offline ? "bg-red-700 text-white" : "bg-amber-100 text-amber-900"} role="status">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm font-semibold">
        <CloudOff className="h-4 w-4" />
        {offline ? "The internet is down. Keep billing in offline mode — bills sync by themselves later." : `${waiting} offline bill${waiting === 1 ? "" : "s"} waiting to sync.`}
        {/* A full page load (not a client-side route change) so the saved copy opens without internet. */}
        <a href="/offline" className={offline ? "ml-auto rounded-lg bg-white px-3 py-1 text-red-700" : "ml-auto underline"}>
          Open offline billing
        </a>
      </div>
    </div>
  );
}
