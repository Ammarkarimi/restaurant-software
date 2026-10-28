"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, MessageCircle, Pencil, Plus, Users, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { minutesOf, timeLabel } from "@/lib/reservations";
import { cn, formatDate, label } from "@/lib/utils";
import type { TableDTO } from "@/lib/types";

interface Reservation {
  id: string;
  name: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  tableId: string | null;
  table: { id: string; name: string; area: string } | null;
  status: string;
  source: string;
  occasion: string | null;
  notes: string | null;
  orderId: string | null;
  createdByName: string;
}

interface DayData {
  date: string;
  today: string;
  reservations: Reservation[];
  requested: number;
  days: Array<{ date: string; bookings: number; guests: number }>;
}

const STATUS_VARIANT: Record<string, string> = { requested: "warning", booked: "info", seated: "success", cancelled: "cancelled", no_show: "danger" };
const SOURCE_LABEL: Record<string, string> = { phone: "Phone", walk_in: "Walk-in", online: "Booking link" };

interface Form {
  id?: string;
  name: string;
  phone: string;
  guests: string;
  date: string;
  time: string;
  tableId: string;
  occasion: string;
  notes: string;
  source: string;
}

function BookingDialog({ initial, tables, onClose, onSaved }: { initial: Form; tables: TableDTO[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: f.name, phone: f.phone, guests: Number(f.guests), date: f.date, time: f.time, tableId: f.tableId || null, occasion: f.occasion || null, notes: f.notes || null, source: f.source };
      if (f.id) await api(`/api/reservations/${f.id}`, { method: "PATCH", body });
      else await api("/api/reservations", { body });
      toast(f.id ? "Booking saved" : `Table booked for ${f.name}`);
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={f.id ? "Change booking" : "Book a table"} size="lg">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest name">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} required autoFocus maxLength={80} />
        </Field>
        <Field label="Phone" hint="For the WhatsApp confirmation">
          <Input type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} required maxLength={20} />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} required />
        </Field>
        <Field label="Time">
          <Input type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} required step={900} />
        </Field>
        <Field label="Guests">
          <Input type="number" min={1} max={200} value={f.guests} onChange={(e) => set({ guests: e.target.value })} required />
        </Field>
        <Field label="Table" optional hint="Choose now or when they arrive">
          <Select value={f.tableId} onChange={(e) => set({ tableId: e.target.value })}>
            <option value="">Not chosen yet</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.area} · {t.seats} seats
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Occasion" optional>
          <Input value={f.occasion} onChange={(e) => set({ occasion: e.target.value })} placeholder="Birthday, anniversary, office party…" maxLength={60} />
        </Field>
        <Field label="Booked by" optional>
          <Select value={f.source} onChange={(e) => set({ source: e.target.value })}>
            <option value="phone">Phone call</option>
            <option value="walk_in">Walk-in</option>
            <option value="online">Booking link</option>
          </Select>
        </Field>
        <Field label="Notes" optional className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. window seat, cake at 9 pm, high chair" maxLength={300} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{f.id ? "Save" : "Book table"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const { toast, confirm, settings } = useApp();
  const [date, setDate] = useState(settings.today);
  const [data, setData] = useState<DayData | null>(null);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [editing, setEditing] = useState<Form | null>(null);
  const [seating, setSeating] = useState<Reservation | null>(null);
  const [restaurantName, setRestaurantName] = useState(settings.restaurantName);

  const load = useCallback(() => {
    api<DayData>(`/api/reservations?date=${date}`).then(setData, (e) => toast(e.message, "error"));
  }, [date, toast]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    api<{ tables: TableDTO[] }>("/api/tables").then((r) => setTables(r.tables.filter((t) => t.active)), () => null);
    api<{ settings: { restaurantName: string } }>("/api/settings").then((r) => setRestaurantName(r.settings.restaurantName), () => null);
  }, []);

  async function patch(r: Reservation, body: Record<string, unknown>, message: string) {
    try {
      await api(`/api/reservations/${r.id}`, { method: "PATCH", body });
      toast(message);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function seat(r: Reservation, tableId: string) {
    try {
      const res = await api<{ orderId: string }>(`/api/reservations/${r.id}`, { method: "PATCH", body: { seat: true, tableId } });
      toast(`${r.name} seated. Take their order.`);
      router.push(`/orders/${res.orderId}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function cancel(r: Reservation, status: "cancelled" | "no_show") {
    const ok = await confirm({ title: status === "cancelled" ? `Cancel ${r.name}'s booking?` : `Mark ${r.name} as did not come?`, confirmText: status === "cancelled" ? "Cancel booking" : "Did not come", danger: true });
    if (ok) patch(r, { status }, status === "cancelled" ? "Booking cancelled" : "Marked as did not come");
  }

  const message = (r: Reservation, kind: "confirm" | "remind") =>
    kind === "confirm"
      ? `Hello ${r.name}, your table for ${r.guests} at ${restaurantName} is booked for ${formatDate(r.date)} at ${timeLabel(r.time)}. See you then!`
      : `Hello ${r.name}, a reminder of your table for ${r.guests} at ${restaurantName} today at ${timeLabel(r.time)}. See you soon!`;

  const blank = (): Form => ({ name: "", phone: "", guests: "2", date, time: "20:00", tableId: "", occasion: "", notes: "", source: "phone" });
  const nowMinutes = (() => {
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: settings.timezone }).format(new Date()).split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Table bookings by phone, walk-in or your booking link. Seat guests with one tap when they arrive."
        actions={
          <Button onClick={() => setEditing(blank())}>
            <Plus className="h-5 w-5" /> Book a table
          </Button>
        }
      />

      {data && data.requested > 0 && (
        <Tip tone="warning">
          <b>{data.requested} booking request{data.requested === 1 ? "" : "s"}</b> from your booking link {data.requested === 1 ? "is" : "are"} waiting. Confirm them and send a WhatsApp confirmation.
        </Tip>
      )}

      {data && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {data.days.map((d) => (
            <button
              key={d.date}
              onClick={() => setDate(d.date)}
              className={cn("min-w-28 shrink-0 rounded-2xl border-2 px-3 py-2 text-left transition", date === d.date ? "border-primary-500 bg-primary-50" : "border-slate-200 bg-white hover:border-primary-300")}
            >
              <span className="block text-sm font-bold text-slate-900">{d.date === data.today ? "Today" : d.date === addDays(data.today, 1) ? "Tomorrow" : formatDate(d.date).replace(/ \d{4}$/, "")}</span>
              <span className="block text-xs text-slate-500">{d.bookings ? `${d.bookings} booking${d.bookings === 1 ? "" : "s"} · ${d.guests} guests` : "No bookings"}</span>
            </button>
          ))}
          <label className="flex shrink-0 items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 px-3 text-sm text-slate-600">
            Other day
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="min-h-9 w-40 py-1" />
          </label>
        </div>
      )}

      {!data ? (
        <Loading />
      ) : data.reservations.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title={`No bookings for ${date === data.today ? "today" : formatDate(date)}`} description="Book a table when a guest calls. They get a WhatsApp confirmation." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.reservations.map((r) => {
              const active = r.status === "booked" || r.status === "requested";
              const late = active && date === data.today && minutesOf(r.time) + 15 < nowMinutes;
              return (
                <li key={r.id} className={cn("flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center", !active && r.status !== "seated" && "opacity-60")}>
                  <div className="w-24 shrink-0">
                    <p className="text-xl font-bold text-slate-900">{timeLabel(r.time)}</p>
                    {late && <p className="text-xs font-semibold text-red-600">Late</p>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      {r.name}
                      <span className="flex items-center gap-1 text-sm font-normal text-slate-600">
                        <Users className="h-4 w-4" /> {r.guests}
                      </span>
                      <Badge variant={STATUS_VARIANT[r.status]}>{label(r.status)}</Badge>
                      {r.occasion && <Badge variant="purple">{r.occasion}</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {r.phone} · {r.table ? `Table ${r.table.name} (${r.table.area})` : "No table chosen"} · {SOURCE_LABEL[r.source] ?? r.source}
                    </p>
                    {r.notes && <p className="text-sm text-amber-800">“{r.notes}”</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.status === "requested" && (
                      <Button size="sm" variant="success" onClick={() => patch(r, { status: "booked" }, "Booking confirmed")}>
                        <Check className="h-4 w-4" /> Confirm
                      </Button>
                    )}
                    {active && (
                      <Button size="sm" onClick={() => (r.tableId ? seat(r, r.tableId) : setSeating(r))}>
                        Seat now
                      </Button>
                    )}
                    {r.status === "seated" && r.orderId && (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/orders/${r.orderId}`)}>
                        Open order
                      </Button>
                    )}
                    {active && (
                      <a href={whatsappLink(r.phone, message(r, date === data.today ? "remind" : "confirm"))} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-emerald-700">
                          <MessageCircle className="h-4 w-4" /> {date === data.today ? "Remind" : "Confirm on WhatsApp"}
                        </Button>
                      </a>
                    )}
                    {active && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Change ${r.name}'s booking`}
                        onClick={() => setEditing({ id: r.id, name: r.name, phone: r.phone, guests: String(r.guests), date: r.date, time: r.time, tableId: r.tableId ?? "", occasion: r.occasion ?? "", notes: r.notes ?? "", source: r.source })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {active && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancel(r, late ? "no_show" : "cancelled")} aria-label={late ? "Did not come" : "Cancel booking"}>
                        <X className="h-4 w-4" /> {late ? "Did not come" : ""}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && (
        <BookingDialog
          initial={editing}
          tables={tables}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {seating && (
        <Modal open onClose={() => setSeating(null)} title={`Seat ${seating.name} (${seating.guests})`} description="Choose a table. An order opens with their name and phone." size="md">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {tables.map((t) => (
              <Button key={t.id} variant="outline" size="lg" className="flex-col gap-0" onClick={() => seat(seating, t.id)}>
                <span>{t.name}</span>
                <span className="text-xs font-normal text-slate-500">{t.seats} seats</span>
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
