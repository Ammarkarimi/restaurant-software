"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, Clock, MessageCircle, Plus, Undo2, Users, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { cn, formatTime } from "@/lib/utils";

interface Entry {
  id: string;
  name: string;
  phone: string | null;
  guests: number;
  quotedMins: number | null;
  notes: string | null;
  status: string;
  tableId: string | null;
  notifiedAt: string | null;
  seatedAt: string | null;
  createdAt: string;
}

interface TableOption {
  id: string;
  name: string;
  area: string;
  seats: number;
  free: boolean;
}

interface WaitData {
  entries: Entry[];
  avgWait: number | null;
  tables: TableOption[];
}

const mins = (from: string, to = Date.now()) => Math.max(0, Math.round((to - new Date(from).getTime()) / 60_000));

function AddDialog({ suggest, onClose, onSaved }: { suggest: number | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ name: "", phone: "", guests: "2", quotedMins: suggest ? String(suggest) : "15", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/waitlist", { body: { name: f.name, phone: f.phone || null, guests: Number(f.guests) || 1, quotedMins: f.quotedMins ? Number(f.quotedMins) : null, notes: f.notes || null } });
      toast(`${f.name} is on the waitlist`);
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Add to waitlist" description="Walk-in guests waiting for a table. Message them on WhatsApp when it is ready, so they can wait outside or nearby.">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus required />
        </Field>
        <Field label="Phone" optional hint="For the “table ready” message">
          <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
        </Field>
        <Field label="Guests">
          <Input type="number" min={1} value={f.guests} onChange={(e) => set({ guests: e.target.value })} />
        </Field>
        <Field label="Wait told to them (minutes)" optional>
          <Select value={f.quotedMins} onChange={(e) => set({ quotedMins: e.target.value })}>
            {["", "5", "10", "15", "20", "30", "45", "60", ...(suggest && ![5, 10, 15, 20, 30, 45, 60].includes(suggest) ? [String(suggest)] : [])].map((m) => (
              <option key={m} value={m}>{m ? `${m} min` : "Not told"}</option>
            ))}
          </Select>
        </Field>
        <Field label="Note" optional className="sm:col-span-2">
          <Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="High chair, outside seating…" />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!f.name.trim()}>Add to waitlist</Button>
        </div>
      </form>
    </Modal>
  );
}

export function WaitlistView({ restaurantName }: { restaurantName: string }) {
  const router = useRouter();
  const { toast, settings } = useApp();
  const [data, setData] = useState<WaitData | null>(null);
  const [adding, setAdding] = useState(false);
  const [seating, setSeating] = useState<Entry | null>(null);
  const [tableId, setTableId] = useState("");
  const [, tick] = useState(0);

  const load = useCallback(() => {
    api<WaitData>("/api/waitlist").then(setData, (e) => toast((e as Error).message, "error"));
  }, [toast]);
  useEffect(() => {
    load();
    // Waiting times count up, and other counters may add guests.
    const t = setInterval(() => {
      tick((n) => n + 1);
      load();
    }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function patch(e: Entry, body: Record<string, unknown>, message?: string) {
    try {
      const r = await api<{ orderId?: string }>(`/api/waitlist/${e.id}`, { method: "PATCH", body });
      if (message) toast(message);
      if (r.orderId) router.push(`/orders/${r.orderId}`);
      else load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  if (!data) return <Loading />;
  const waiting = data.entries.filter((e) => e.status === "waiting");
  const done = data.entries.filter((e) => e.status !== "waiting").reverse();
  const free = data.tables.filter((t) => t.free);
  const readyText = (e: Entry) => `Hello ${e.name}, your table for ${e.guests} at ${restaurantName} is ready. Please come to the counter. See you in a minute!`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Waitlist"
        description="Walk-ins waiting for a table. Message them when it is ready and seat them with one tap."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-5 w-5" /> Add to waitlist</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Waiting now" value={`${waiting.length} ${waiting.length === 1 ? "party" : "parties"}`} subtitle={`${waiting.reduce((s, e) => s + e.guests, 0)} guests`} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Free tables" value={free.length} subtitle={free.slice(0, 4).map((t) => t.name).join(", ") || "All busy"} icon={<Armchair className="h-5 w-5" />} tone="green" />
        <StatCard title="Average wait today" value={data.avgWait !== null ? `${data.avgWait} min` : "—"} icon={<Clock className="h-5 w-5" />} tone="sky" />
        <StatCard title="Seated from waitlist" value={done.filter((e) => e.status === "seated").length} tone="slate" />
      </div>
      <Card>
        {waiting.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Users className="h-6 w-6" />} title="No one is waiting" description="When the restaurant is full, add walk-ins here instead of a paper list." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {waiting.map((e, i) => {
              const waited = mins(e.createdAt);
              const late = e.quotedMins !== null && waited > e.quotedMins;
              const fits = free.filter((t) => t.seats >= e.guests);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {e.name} · {e.guests} {e.guests === 1 ? "guest" : "guests"}
                      {e.notifiedAt && <Badge variant="info" className="ml-2">Told {formatTime(e.notifiedAt, settings.timezone)}</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      <span className={cn(late && "font-semibold text-red-700")}>Waiting {waited} min</span>
                      {e.quotedMins !== null && ` · told ${e.quotedMins} min`}
                      {e.phone && ` · ${e.phone}`}
                      {e.notes && ` · ${e.notes}`}
                      {fits.length > 0 && <span className="text-emerald-700"> · fits {fits.slice(0, 3).map((t) => t.name).join(", ")}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.phone && (
                      <a href={whatsappLink(e.phone, readyText(e))} target="_blank" rel="noreferrer" onClick={() => patch(e, { action: "notified" })}>
                        <Button size="sm" variant="outline"><MessageCircle className="h-4 w-4" /> Table ready</Button>
                      </a>
                    )}
                    <Button size="sm" onClick={() => { setSeating(e); setTableId(fits[0]?.id ?? free[0]?.id ?? ""); }}>Seat</Button>
                    <Button size="sm" variant="ghost" onClick={() => patch(e, { action: "left" }, `${e.name} left`)} aria-label={`${e.name} left`}><X className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {done.length > 0 && (
        <Card>
          <p className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Earlier today</p>
          <ul className="divide-y divide-slate-100">
            {done.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="flex-1 text-slate-700">
                  {e.name} · {e.guests} · {e.status === "seated" ? `seated after ${mins(e.createdAt, new Date(e.seatedAt!).getTime())} min${e.tableId ? ` at ${data.tables.find((t) => t.id === e.tableId)?.name ?? "a table"}` : ""}` : "left without a table"}
                </span>
                {e.status === "left" && (
                  <Button size="sm" variant="ghost" onClick={() => patch(e, { action: "back" }, `${e.name} is back on the list`)}><Undo2 className="h-4 w-4" /> Back</Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {adding && <AddDialog suggest={data.avgWait} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {seating && (
        <Modal
          open
          onClose={() => setSeating(null)}
          title={`Seat ${seating.name} (${seating.guests})`}
          description="Opens their order on the table with their name and phone."
          footer={
            <>
              <Button variant="outline" onClick={() => setSeating(null)}>Cancel</Button>
              <Button disabled={!tableId} onClick={() => patch(seating, { action: "seat", tableId }, `${seating.name} seated. Take their order.`)}>Seat and take order</Button>
            </>
          }
        >
          {free.length === 0 ? (
            <p className="text-slate-600">All tables are busy right now.</p>
          ) : (
            <Field label="Table">
              <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                {free.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.area} · {t.seats} seats{t.seats < seating.guests ? " (small)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}
