"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/client";
import { ding } from "@/lib/ding";
import { cn, label } from "@/lib/utils";
import type { DisplayToken } from "@/lib/types";

const SOUND_KEY = "display:sound";

/** Says "Order number 42 is ready" out loud, where the device can speak. */
function announce(tokens: number[]) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    for (const t of tokens) {
      const u = new SpeechSynthesisUtterance(`Order number ${t} is ready`);
      u.lang = "en-IN";
      u.rate = 0.9;
      synth.speak(u);
    }
  } catch {
    // no speech on this device
  }
}

export function TokenScreen({ restaurantName, logoUrl }: { restaurantName: string; logoUrl: string | null }) {
  const [tokens, setTokens] = useState<DisplayToken[] | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const known = useRef<Map<number, string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) === "on");
    } catch {
      // private mode
    }
  }, []);

  const load = useCallback(() => {
    api<{ tokens: DisplayToken[] }>("/api/display").then(
      (r) => {
        setError("");
        setTokens(r.tokens);
        const now = new Map(r.tokens.map((t) => [t.token, t.status]));
        // Newly ready tokens flash and are announced (not on the first load).
        if (known.current) {
          const ready = r.tokens.filter((t) => t.status === "ready" && known.current!.get(t.token) !== "ready").map((t) => t.token);
          if (ready.length) {
            setFresh((f) => new Set([...f, ...ready]));
            setTimeout(() => setFresh((f) => new Set([...f].filter((x) => !ready.includes(x)))), 30_000);
            if (soundRef.current) {
              ding();
              announce(ready);
            }
          }
        }
        known.current = now;
      },
      (e) => setError(e.message)
    );
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  const preparing = (tokens ?? []).filter((t) => t.status === "preparing");
  const ready = (tokens ?? []).filter((t) => t.status === "ready").sort((a, b) => (b.readyAt ?? "").localeCompare(a.readyAt ?? ""));

  // Order numbers grow over the months: longer numbers get a smaller font so they never overflow the card.
  const digits = (t: DisplayToken) => String(t.token).length;
  const size = (t: DisplayToken, big: boolean) =>
    big ? (digits(t) <= 3 ? "text-8xl" : digits(t) === 4 ? "text-7xl" : "text-6xl") : digits(t) <= 3 ? "text-6xl" : digits(t) === 4 ? "text-5xl" : "text-4xl";

  const card = (t: DisplayToken, big: boolean) => (
    <div
      key={t.orderId}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-3xl px-4 py-5 text-center shadow-lg",
        big ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-100",
        fresh.has(t.token) && "scale-105 ring-8 ring-emerald-300"
      )}
    >
      <span className={cn("font-black tabular-nums leading-none", size(t, big))}>{t.token}</span>
      <span className={cn("mt-2 text-sm font-semibold uppercase tracking-wide", big ? "text-emerald-50" : "text-slate-400")}>
        {t.source !== "counter" && t.source !== "website" ? `${label(t.source)}${t.sourceRef ? ` ${t.sourceRef}` : ""}` : t.type === "delivery" ? "Delivery" : t.name || "Takeaway"}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center gap-4 px-8 py-5">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl bg-white object-contain p-1" />
        )}
        <h1 className="text-3xl font-extrabold">{restaurantName}</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const next = !sound;
              setSound(next);
              if (next) {
                ding();
                announce([]);
              }
              try {
                localStorage.setItem(SOUND_KEY, next ? "on" : "off");
              } catch {
                // private mode
              }
            }}
            className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold", sound ? "bg-slate-800" : "bg-amber-500 text-slate-900")}
          >
            {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} {sound ? "Sound on" : "Tap to turn sound on"}
          </button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-xl bg-slate-800 p-2" aria-label="Full screen">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </header>
      {error && <p className="mx-8 rounded-xl bg-red-600/30 px-4 py-2">{error}</p>}
      <div className="grid flex-1 grid-cols-1 gap-6 px-8 pb-8 lg:grid-cols-[2fr_3fr]">
        <section className="flex flex-col rounded-3xl bg-slate-900 p-6">
          <h2 className="mb-4 text-2xl font-bold text-amber-400">Preparing</h2>
          {preparing.length === 0 ? (
            <p className="text-lg text-slate-500">Nothing cooking right now.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">{preparing.map((t) => card(t, false))}</div>
          )}
        </section>
        <section className="flex flex-col rounded-3xl bg-slate-900 p-6">
          <h2 className="mb-4 text-2xl font-bold text-emerald-400">Ready — please collect</h2>
          {ready.length === 0 ? (
            <p className="text-lg text-slate-500">Your order number appears here when it is ready.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-5">{ready.map((t) => card(t, true))}</div>
          )}
        </section>
      </div>
      <footer className="px-8 pb-5 text-center text-sm text-slate-500">Your order number is printed on your bill.</footer>
    </div>
  );
}
