"use client";

import { useState } from "react";
import { CalendarCheck, UtensilsCrossed } from "lucide-react";
import { Button, Field, Input, Select, Textarea, Tip } from "@/components/ui";
import { api } from "@/lib/client";
import { timeLabel } from "@/lib/reservations";
import { formatDate } from "@/lib/utils";

const SLOTS = Array.from({ length: 30 }, (_, i) => {
  const minutes = 11 * 60 + i * 30; // 11:00 to 23:30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function BookingForm({
  slug,
  restaurant,
  today,
  lastDay,
}: {
  slug: string;
  restaurant: { name: string; address: string; phone: string | null; logoUrl: string | null };
  today: string;
  lastDay: string;
}) {
  const [f, setF] = useState({ name: "", phone: "", guests: "2", date: today, time: "20:00", occasion: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api(`/api/public/booking/${slug}`, { body: { ...f, guests: Number(f.guests), occasion: f.occasion || null, notes: f.notes || null } });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logoUrl} alt="" className="mx-auto mb-2 h-16 max-w-[60%] object-contain" />
          ) : (
            <div className="mx-auto mb-2 w-fit rounded-2xl bg-primary-600 p-3 text-white">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
          {restaurant.address && <p className="text-sm text-slate-500">{restaurant.address}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {done ? (
            <div className="space-y-3 text-center">
              <CalendarCheck className="mx-auto h-12 w-12 text-emerald-600" />
              <p className="text-lg font-bold text-slate-900">Request sent, {f.name.split(" ")[0]}!</p>
              <p className="text-slate-600">
                A table for {f.guests} on {formatDate(f.date)} at {timeLabel(f.time)}. The restaurant will confirm on WhatsApp or by phone ({f.phone}).
              </p>
              {restaurant.phone && <p className="text-sm text-slate-500">Questions? Call {restaurant.phone}</p>}
            </div>
          ) : (
            <form onSubmit={send} className="grid gap-4">
              <h2 className="text-lg font-bold text-slate-900">Book a table</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input type="date" value={f.date} min={today} max={lastDay} onChange={(e) => set({ date: e.target.value })} required />
                </Field>
                <Field label="Time">
                  <Select value={f.time} onChange={(e) => set({ time: e.target.value })}>
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>{timeLabel(s)}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Guests">
                <Select value={f.guests} onChange={(e) => set({ guests: e.target.value })}>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Your name">
                <Input value={f.name} onChange={(e) => set({ name: e.target.value })} required maxLength={80} />
              </Field>
              <Field label="Phone / WhatsApp">
                <Input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} required maxLength={20} />
              </Field>
              <Field label="Occasion" optional>
                <Input value={f.occasion} onChange={(e) => set({ occasion: e.target.value })} placeholder="Birthday, anniversary…" maxLength={60} />
              </Field>
              <Field label="Anything we should know?" optional>
                <Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} />
              </Field>
              {error && <Tip tone="danger">{error}</Tip>}
              <Button type="submit" size="lg" loading={sending}>
                Ask for this table
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
