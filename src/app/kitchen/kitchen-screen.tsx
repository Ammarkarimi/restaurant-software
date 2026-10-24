"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, BellOff, Check, ChefHat, CircleSlash, LogOut, Maximize, Undo2 } from "lucide-react";
import { api } from "@/lib/client";
import { ding } from "@/lib/ding";
import { cn, label } from "@/lib/utils";
import type { CategoryDTO, KitchenTicket } from "@/lib/types";

const SOUND_KEY = "kitchen:sound";

function minutes(from: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
}

function Ticket({ t, now, onItem, onAll }: { t: KitchenTicket; now: number; onItem: (id: string, status: string) => void; onAll: (t: KitchenTicket, status: string) => void }) {
  const age = minutes(t.sentAt, now);
  const ready = t.status === "ready";
  const where = t.type === "dine_in" ? (t.table ? `Table ${t.table}` : "Dine-in") : label(t.type);
  const tone = ready ? "border-emerald-500" : age >= 20 ? "border-red-500" : age >= 10 ? "border-amber-400" : "border-slate-600";
  return (
    <div className={cn("flex flex-col rounded-2xl border-t-8 bg-slate-800 text-slate-100 shadow-lg", tone)}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-extrabold">{where}</p>
          <p className="text-sm text-slate-400">
            KOT {t.kotNumber} · Order #{t.orderNumber}
            {t.customerName && t.type !== "dine_in" && ` · ${t.customerName}`}
          </p>
          {t.source !== "counter" && (
            <p className="mt-0.5 inline-block rounded bg-violet-600 px-1.5 text-xs font-bold uppercase">
              {label(t.source)}
              {t.sourceRef && ` #${t.sourceRef}`}
            </p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-lg px-2 py-1 text-lg font-bold tabular-nums", ready ? "bg-emerald-600" : age >= 20 ? "bg-red-600" : age >= 10 ? "bg-amber-500 text-slate-900" : "bg-slate-700")}>
          {age} min
        </span>
      </div>
      {t.notes && <p className="mx-4 mt-2 rounded-lg bg-amber-500/20 px-2 py-1 text-sm font-semibold text-amber-200">Note: {t.notes}</p>}
      <ul className="flex-1 space-y-1 px-2 py-2">
        {t.items.map((i) => (
          <li key={i.id}>
            <button
              disabled={i.cancelled}
              onClick={() => onItem(i.id, i.kitchenStatus === "ready" ? "new" : "ready")}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left transition",
                i.cancelled ? "opacity-60" : "hover:bg-slate-700",
                i.kitchenStatus === "ready" && !i.cancelled && "text-emerald-300"
              )}
            >
              <span className={cn("w-8 shrink-0 text-right text-xl font-extrabold", i.cancelled && "line-through")}>{i.quantity}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-lg font-semibold leading-snug", (i.cancelled || i.kitchenStatus === "ready") && "line-through")}>
                  {i.name}
                  {i.variant && <span className="font-normal text-slate-300"> ({i.variant})</span>}
                </span>
                {i.note && <span className="block text-sm font-semibold text-amber-300">** {i.note}</span>}
                {i.cancelled && <span className="block text-sm font-bold text-red-400">CANCELLED — do not make</span>}
              </span>
              {i.kitchenStatus === "ready" && !i.cancelled && <Check className="mt-1 h-5 w-5 shrink-0" />}
              {i.cancelled && <CircleSlash className="mt-1 h-5 w-5 shrink-0 text-red-400" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="p-3 pt-0">
        {ready ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button onClick={() => onAll(t, "new")} className="rounded-xl bg-slate-700 px-3 py-3 font-semibold hover:bg-slate-600" aria-label="Back to cooking">
              <Undo2 className="h-5 w-5" />
            </button>
            <button onClick={() => onAll(t, "served")} className="rounded-xl bg-slate-100 py-3 text-lg font-bold text-slate-900 hover:bg-white">
              Served
            </button>
          </div>
        ) : (
          <button onClick={() => onAll(t, "ready")} className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold hover:bg-emerald-500">
            <Check className="mr-1 inline h-5 w-5" /> All ready
          </button>
        )}
      </div>
    </div>
  );
}

export function KitchenScreen({ restaurantName, timezone, userName, kitchenOnly }: { restaurantName: string; timezone: string; userName: string; kitchenOnly: boolean }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const [soldOut, setSoldOut] = useState<CategoryDTO[] | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {
      // private mode
    }
  }, []);

  const load = useCallback(() => {
    api<{ tickets: KitchenTicket[] }>("/api/kitchen").then(
      (r) => {
        setError("");
        setTickets(r.tickets);
        const keys = new Set(r.tickets.map((t) => t.key));
        // Ding for tickets that arrived since the last look (not on the first load).
        if (seen.current && [...keys].some((k) => !seen.current!.has(k)) && soundRef.current) ding();
        seen.current = keys;
      },
      (e) => setError(e.message)
    );
  }, []);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function mark(itemIds: string[], status: string) {
    // Show the change at once; the next refresh confirms it.
    setTickets(
      (ts) =>
        ts &&
        ts
          .map((t): KitchenTicket => {
            const items = t.items.map((i) => (itemIds.includes(i.id) ? { ...i, kitchenStatus: status } : i));
            return { ...t, items, status: items.some((i) => !i.cancelled && i.kitchenStatus === "new") ? "new" : "ready" };
          })
          .filter((t) => t.items.some((i) => !i.cancelled && i.kitchenStatus !== "served"))
    );
    try {
      await api("/api/kitchen", { method: "PATCH", body: { itemIds, status } });
    } catch (e) {
      setError((e as Error).message);
    }
    load();
  }

  async function toggleAvailable(id: string, available: boolean) {
    setSoldOut((cs) => cs && cs.map((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, available } : i)) })));
    await api(`/api/menu/items/${id}`, { method: "PATCH", body: { available } }).catch((e) => setError(e.message));
  }

  const cooking = (tickets ?? []).filter((t) => t.status === "new");
  const ready = (tickets ?? []).filter((t) => t.status === "ready");
  const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(now);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur">
        {!kitchenOnly && (
          <Link href="/" className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Tables
          </Link>
        )}
        <ChefHat className="h-7 w-7 text-amber-400" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{restaurantName} · Kitchen</p>
          <p className="text-xs text-slate-400">
            {cooking.length} cooking · {ready.length} ready to serve · {userName}
          </p>
        </div>
        {/* The clock ticks in the browser; the server's minute may differ. */}
        <span className="ml-auto text-2xl font-bold tabular-nums" suppressHydrationWarning>
          {clock}
        </span>
        <button
          onClick={() => {
            const next = !sound;
            setSound(next);
            if (next) ding();
            try {
              localStorage.setItem(SOUND_KEY, next ? "on" : "off");
            } catch {
              // private mode
            }
          }}
          className="rounded-xl p-2 hover:bg-slate-800"
          aria-label={sound ? "Sound on" : "Sound off"}
          title={sound ? "Sound on for new tickets" : "Sound off"}
        >
          {sound ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6 text-slate-500" />}
        </button>
        <button
          onClick={() => (soldOut ? setSoldOut(null) : api<{ categories: CategoryDTO[] }>("/api/menu").then((r) => setSoldOut(r.categories.filter((c) => c.active))))}
          className={cn("rounded-xl px-3 py-2 text-sm font-semibold", soldOut ? "bg-amber-500 text-slate-900" : "bg-slate-800 hover:bg-slate-700")}
        >
          Sold out dishes
        </button>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-xl p-2 hover:bg-slate-800" aria-label="Full screen">
          <Maximize className="h-6 w-6" />
        </button>
        {kitchenOnly && (
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            className="rounded-xl p-2 hover:bg-slate-800"
            aria-label="Sign out"
          >
            <LogOut className="h-6 w-6" />
          </button>
        )}
      </header>

      {error && <p className="mx-4 mt-3 rounded-xl bg-red-600/20 px-4 py-2 text-red-200">{error}</p>}

      {soldOut && (
        <section className="mx-4 mt-4 rounded-2xl bg-slate-800 p-4">
          <p className="mb-3 font-semibold">Tap a dish to mark it sold out today. The tills stop selling it at once.</p>
          <div className="space-y-3">
            {soldOut.map((c) => (
              <div key={c.id}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{c.name}</p>
                <div className="flex flex-wrap gap-2">
                  {c.items.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => toggleAvailable(i.id, !i.available)}
                      className={cn("rounded-xl px-3 py-2 text-sm font-semibold", i.available ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600 line-through")}
                    >
                      {i.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!tickets ? (
        <p className="p-10 text-center text-slate-400">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center text-slate-400">
          <ChefHat className="h-16 w-16 text-slate-600" />
          <p className="text-xl font-semibold">No orders to cook</p>
          <p>New kitchen tickets appear here by themselves when the tills press “Send to kitchen”.</p>
        </div>
      ) : (
        <div className="space-y-6 p-4">
          {cooking.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {cooking.map((t) => (
                <Ticket key={t.key} t={t} now={now} onItem={(id, s) => mark([id], s)} onAll={(x, s) => mark(x.items.filter((i) => !i.cancelled || s === "served").map((i) => i.id), s)} />
              ))}
            </div>
          )}
          {ready.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-400">Ready to serve</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {ready.map((t) => (
                  <Ticket key={t.key} t={t} now={now} onItem={(id, s) => mark([id], s)} onAll={(x, s) => mark(x.items.map((i) => i.id), s)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
