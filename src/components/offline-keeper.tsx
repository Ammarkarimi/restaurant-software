"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CloudOff } from "lucide-react";
import { getQueue, isBillingPage, reachable, refreshBootstrap, setReturnTo, syncOfflineBills } from "@/lib/offline-client";

/** Seconds the cashier gets to finish a tap before the billing screen moves to offline billing. */
const SWITCH_AFTER = 8;

function switchNow() {
  const { pathname, search } = window.location;
  // A new table order is finished in offline billing, so come back to the Tables screen, not an empty order.
  const newTableOrder = pathname === "/orders/new" && (new URLSearchParams(search).get("type") ?? "dine_in") === "dine_in";
  setReturnTo(newTableOrder ? "/" : pathname + search);
  // A full page load (not a client-side route change) so the saved copy opens without internet.
  window.location.href = "/offline";
}

/**
 * Runs inside the app: saves the offline billing screen and the menu on this device, sends bills
 * made offline to the server, and moves the billing screen to offline billing by itself when the
 * internet drops (other pages only show a banner).
 */
export function OfflineKeeper() {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  // "Stay here" holds the switch until the internet has come back once.
  const stayed = useRef(false);

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
    let alive = true;
    let wasDown = false;
    const setDown = (down: boolean) => {
      if (!alive) return;
      if (!down && wasDown) stayed.current = false;
      wasDown = down;
      setOffline(down);
    };

    const sync = async () => {
      await refreshBootstrap();
      if (getQueue().length) await syncOfflineBills();
      if (alive) setWaiting(getQueue().length);
    };

    // Two failed checks a few seconds apart before calling it offline, so one slow request doesn't.
    let checking = false;
    const check = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        let ok = await reachable();
        if (!ok && navigator.onLine) {
          await new Promise((r) => setTimeout(r, 3000));
          ok = await reachable();
        }
        if (ok && wasDown) sync();
        setDown(!ok);
      } finally {
        checking = false;
      }
    };

    setWaiting(getQueue().length);
    if (navigator.onLine) sync();
    else setDown(true);
    check();
    const pings = setInterval(check, 20_000);
    const refresh = setInterval(() => navigator.onLine && sync(), 10 * 60_000);
    const up = () => check();
    const down = () => setDown(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    document.addEventListener("visibilitychange", up);
    return () => {
      alive = false;
      clearInterval(pings);
      clearInterval(refresh);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      document.removeEventListener("visibilitychange", up);
    };
  }, []);

  // On a billing screen, count down and then open offline billing.
  const autoSwitch = offline && isBillingPage(pathname) && !stayed.current;
  useEffect(() => {
    if (!autoSwitch) return setCountdown(null);
    let left = SWITCH_AFTER;
    setCountdown(left);
    const t = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(t);
        switchNow();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [autoSwitch, pathname]);

  function stay() {
    stayed.current = true;
    setCountdown(null);
  }

  if (!offline && !waiting) return null;
  return (
    <div className={offline ? "bg-red-700 text-white" : "bg-amber-100 text-amber-900"} role="status">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm font-semibold">
        <CloudOff className="h-4 w-4" />
        {!offline
          ? `${waiting} offline bill${waiting === 1 ? "" : "s"} waiting to sync.`
          : countdown !== null
            ? `The internet is down. Moving to offline billing in ${countdown} s — bills sync by themselves when it's back.`
            : "The internet is down. Keep billing in offline mode — bills sync by themselves later."}
        <span className="ml-auto flex items-center gap-2">
          {offline && countdown !== null && (
            <button onClick={stay} className="rounded-lg px-3 py-1 underline">
              Stay here
            </button>
          )}
          {offline ? (
            <button onClick={switchNow} className="rounded-lg bg-white px-3 py-1 text-red-700">
              {countdown !== null ? "Switch now" : "Open offline billing"}
            </button>
          ) : (
            <a href="/offline" className="underline">
              Open offline billing
            </a>
          )}
        </span>
      </div>
    </div>
  );
}
