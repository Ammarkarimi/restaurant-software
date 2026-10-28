"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Reloads the order status every few seconds while the guest waits. */
export function Refresher({ every = 10_000, active }: { every?: number; active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every, active]);
  return null;
}
