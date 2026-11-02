"use client";
// The counter's own copy of the menu and the bills made while offline (kept in this browser).
import type { OfflineBill, OfflineBootstrap } from "./offline";

const KEYS = { boot: "offline:bootstrap", queue: "offline:queue", done: "offline:done", device: "offline:device", seq: "offline:seq" };

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: nothing more we can do
  }
}

export const getBootstrap = () => read<OfflineBootstrap | null>(KEYS.boot, null);
export const getQueue = () => read<Array<OfflineBill & { error?: string }>>(KEYS.queue, []);
export const getDone = () => read<Array<OfflineBill & { orderNumber?: number }>>(KEYS.done, []);

/** Saves the latest menu and prices on this device (done in the background while online). */
export async function refreshBootstrap(): Promise<OfflineBootstrap | null> {
  try {
    const res = await fetch("/api/offline/bootstrap", { cache: "no-store" });
    if (!res.ok) return getBootstrap();
    const data = (await res.json()) as OfflineBootstrap;
    write(KEYS.boot, data);
    return data;
  } catch {
    return getBootstrap();
  }
}

/** A short code for this device, so its offline bill numbers never clash with another counter's. */
export function deviceCode() {
  let code = read<string | null>(KEYS.device, null);
  if (!code) {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    code = abc[Math.floor(Math.random() * abc.length)] + abc[Math.floor(Math.random() * abc.length)];
    write(KEYS.device, code);
  }
  return code;
}

/** Next offline bill number on this device, e.g. "OFFKQ-12" (with the restaurant's bill prefix in front). */
export function nextOfflineBillNumber(prefix: string) {
  const n = read<number>(KEYS.seq, 0) + 1;
  write(KEYS.seq, n);
  return `${prefix}OFF${deviceCode()}-${n}`;
}

export function saveOfflineBill(bill: OfflineBill) {
  write(KEYS.queue, [...getQueue(), bill]);
}

let syncing: Promise<{ synced: number; failed: number }> | null = null;

/** Sends waiting bills to the server. Safe to call often: a bill already saved is never added twice. */
export function syncOfflineBills(): Promise<{ synced: number; failed: number }> {
  if (syncing) return syncing;
  const queue = getQueue();
  if (!queue.length) return Promise.resolve({ synced: 0, failed: 0 });
  syncing = (async () => {
    try {
      const res = await fetch("/api/offline/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bills: queue.map(({ error: _e, ...b }) => b) }) });
      if (!res.ok) return { synced: 0, failed: queue.length };
      const { results } = (await res.json()) as { results: Array<{ clientId: string; ok: boolean; number?: number; error?: string }> };
      const byId = new Map(results.map((r) => [r.clientId, r]));
      const left = getQueue().filter((b) => !byId.get(b.clientId)?.ok).map((b) => ({ ...b, error: byId.get(b.clientId)?.error }));
      const done = queue.filter((b) => byId.get(b.clientId)?.ok).map((b) => ({ ...b, orderNumber: byId.get(b.clientId)?.number }));
      write(KEYS.queue, left);
      write(KEYS.done, [...done, ...getDone()].slice(0, 50));
      return { synced: done.length, failed: left.length };
    } catch {
      return { synced: 0, failed: queue.length };
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}
