"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, MessageCircle, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Field, Input, Loading, Modal, Select, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { banquetTotals, BANQUET_PAYMENT_METHODS, EVENT_TYPES, NEXT_STATUS, parseMenu, timeText, type BanquetStatus, type Extra } from "@/lib/banquet";
import { can } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, label } from "@/lib/utils";
import { StatusChip } from "../status-chip";
import type { HallDTO, PackageDTO } from "../setup";

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  date: string;
  receivedBy: string | null;
}
interface EventDTO {
  id: string;
  number: number;
  status: BanquetStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerGstin: string | null;
  company: string | null;
  eventType: string;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string;
  hallId: string | null;
  hall: { id: string; name: string; capacity: number } | null;
  guests: number;
  guaranteedGuests: number;
  finalGuests: number | null;
  packageId: string | null;
  packageName: string | null;
  pricePerPlate: number;
  menu: string[];
  extras: Extra[];
  hallRent: number;
  discount: number;
  foodTaxRate: number;
  otherTaxRate: number;
  taxMode: string;
  notes: string | null;
  cancelReason: string | null;
  invoiceNumber: string | null;
  payments: Payment[];
  paid: number;
  balance: number;
  totals: ReturnType<typeof banquetTotals>;
}
interface Clash {
  id: string;
  number: number;
  customerName: string;
  startTime: string;
  endTime: string;
  status: string;
}

type Form = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerGstin: string;
  company: string;
  eventType: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  hallId: string;
  guests: string;
  guaranteedGuests: string;
  finalGuests: string;
  packageId: string;
  pricePerPlate: string;
  menu: string;
  extras: Array<{ name: string; amount: string }>;
  hallRent: string;
  discount: string;
  foodTaxRate: string;
  otherTaxRate: string;
  notes: string;
};

function toForm(e: EventDTO | null, defaults: { foodTaxRate: number }): Form {
  return {
    customerName: e?.customerName ?? "",
    customerPhone: e?.customerPhone ?? "",
    customerEmail: e?.customerEmail ?? "",
    customerGstin: e?.customerGstin ?? "",
    company: e?.company ?? "",
    eventType: e?.eventType ?? "Birthday",
    title: e?.title ?? "",
    date: e?.date ?? "",
    startTime: e?.startTime ?? "19:00",
    endTime: e?.endTime ?? "23:00",
    hallId: e?.hallId ?? "",
    guests: String(e?.guests ?? 50),
    guaranteedGuests: String(e?.guaranteedGuests ?? 0),
    finalGuests: e?.finalGuests != null ? String(e.finalGuests) : "",
    packageId: e?.packageId ?? "",
    pricePerPlate: String(e?.pricePerPlate ?? ""),
    menu: (e?.menu ?? []).join("\n"),
    extras: (e?.extras ?? []).map((x) => ({ name: x.name, amount: String(x.amount) })),
    hallRent: String(e?.hallRent ?? 0),
    discount: String(e?.discount ?? 0),
    foodTaxRate: String(e?.foodTaxRate ?? defaults.foodTaxRate),
    otherTaxRate: String(e?.otherTaxRate ?? 18),
    notes: e?.notes ?? "",
  };
}

function toBody(f: Form) {
  const n = (s: string) => Number(s) || 0;
  return {
    customerName: f.customerName,
    customerPhone: f.customerPhone,
    customerEmail: f.customerEmail,
    customerGstin: f.customerGstin,
    company: f.company,
    eventType: f.eventType,
    title: f.title,
    date: f.date,
    startTime: f.startTime,
    endTime: f.endTime,
    hallId: f.hallId || null,
    guests: n(f.guests),
    guaranteedGuests: n(f.guaranteedGuests),
    finalGuests: f.finalGuests === "" ? null : n(f.finalGuests),
    packageId: f.packageId || null,
    pricePerPlate: n(f.pricePerPlate),
    menu: f.menu.split("\n").map((l) => l.trim()).filter(Boolean),
    extras: f.extras.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), amount: n(x.amount) })),
    hallRent: n(f.hallRent),
    discount: n(f.discount),
    foodTaxRate: n(f.foodTaxRate),
    otherTaxRate: n(f.otherTaxRate),
    notes: f.notes,
  };
}

function PaymentDialog({ event, onClose, onSaved }: { event: EventDTO; onClose: () => void; onSaved: (e: EventDTO) => void }) {
  const { toast } = useApp();
  const suggested = event.paid === 0 && event.status !== "completed" ? Math.round(event.totals.total * 0.3) : Math.max(0, Math.round(event.balance));
  const [f, setF] = useState({ amount: String(suggested || ""), method: "upi", reference: "", note: event.paid === 0 ? "Advance" : "", refund: false });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const amount = (Number(f.amount) || 0) * (f.refund ? -1 : 1);
      const r = await api<{ event: EventDTO }>(`/api/banquets/${event.id}/payments`, { body: { amount, method: f.method, reference: f.reference, note: f.note } });
      toast(f.refund ? "Refund saved" : "Payment saved");
      onSaved(r.event);
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={f.refund ? "Refund money" : "Take a payment"} description={`Total ${formatCurrency(event.totals.total)} · paid ${formatCurrency(event.paid)} · balance ${formatCurrency(event.balance)}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save} variant={f.refund ? "danger" : "success"}>{f.refund ? "Save refund" : "Payment received"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)"><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Paid by"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{BANQUET_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select></Field>
        <Field label="Reference" optional><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="UPI ref, cheque no." /></Field>
        <Field label="Note" optional><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Advance, final payment" /></Field>
        {event.paid > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={f.refund} onChange={(e) => setF({ ...f, refund: e.target.checked })} /> This is a refund to the customer
          </label>
        )}
        {event.paid === 0 && !f.refund && <p className="text-xs text-slate-500 sm:col-span-2">Suggested advance: 30% of the total. Cash counts in today&apos;s cash drawer.</p>}
      </div>
    </Modal>
  );
}

export default function BanquetEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const { user, isAdmin, toast, confirm, settings: shell } = useApp();
  const [event, setEvent] = useState<EventDTO | null>(null);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [halls, setHalls] = useState<HallDTO[]>([]);
  const [packages, setPackages] = useState<PackageDTO[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "pay" | "cancel" | "complete">(null);
  const [reason, setReason] = useState("");
  const [finalGuests, setFinalGuests] = useState("");
  const [defaults, setDefaults] = useState({ foodTaxRate: 5, restaurantName: "", taxMode: "gst" });

  const load = useCallback(async () => {
    const [list, s] = await Promise.all([api<{ halls: HallDTO[]; packages: PackageDTO[]; today: string }>("/api/banquets?view=upcoming"), api<{ settings: { defaultTaxRate: number; restaurantName: string; taxMode: string } }>("/api/settings")]);
    setHalls(list.halls);
    setPackages(list.packages);
    const d = { foodTaxRate: s.settings.defaultTaxRate, restaurantName: s.settings.restaurantName, taxMode: s.settings.taxMode };
    setDefaults(d);
    if (isNew) {
      const f = toForm(null, d);
      setForm(f);
      setSaved(JSON.stringify(f));
    } else {
      const r = await api<{ event: EventDTO; clashes: Clash[] }>(`/api/banquets/${id}`);
      setEvent(r.event);
      setClashes(r.clashes);
      const f = toForm(r.event, d);
      setForm(f);
      setSaved(JSON.stringify(f));
    }
  }, [id, isNew]);
  useEffect(() => {
    load().catch((e) => toast((e as Error).message, "error"));
  }, [load, toast]);

  const f = form;
  const locked = event?.status === "completed" || event?.status === "cancelled";
  const dirty = f ? JSON.stringify(f) !== saved : false;
  const totals = useMemo(() => {
    if (!f) return null;
    const b = toBody(f);
    return banquetTotals({ ...b, taxMode: event?.taxMode ?? (defaults.taxMode === "none" ? "none" : "gst") });
  }, [f, event?.taxMode, defaults.taxMode]);

  if (!can(user, "banquets")) return <Tip tone="warning">You are not allowed to handle banquet bookings.</Tip>;
  if (!f || !totals) return <Loading />;
  const set = (p: Partial<Form>) => setForm((x) => (x ? { ...x, ...p } : x));
  const hall = halls.find((h) => h.id === f.hallId);
  const overCapacity = hall && Number(f.guests) > hall.capacity;

  function pickPackage(pid: string) {
    const p = packages.find((x) => x.id === pid);
    if (!p) return set({ packageId: "" });
    const menu = parseMenu(p.menu).join("\n");
    set({ packageId: pid, pricePerPlate: String(p.pricePerPlate), menu: !f!.menu.trim() || f!.menu === parseMenu(packages.find((x) => x.id === f!.packageId)?.menu).join("\n") ? menu : f!.menu });
    if (f!.menu.trim() && f!.menu !== menu && f!.packageId !== pid) toast("Price updated. Your own menu lines were kept — clear them to use the package menu.", "info");
  }
  function pickHall(hid: string) {
    const h = halls.find((x) => x.id === hid);
    set({ hallId: hid, ...(h && (!Number(f!.hallRent) || halls.some((x) => x.id === f!.hallId && x.rent === Number(f!.hallRent))) ? { hallRent: String(h.rent) } : {}) });
  }

  async function save() {
    setSaving(true);
    try {
      if (isNew) {
        const r = await api<{ event: EventDTO }>("/api/banquets", { body: toBody(f!) });
        toast(`Booking #${r.event.number} saved`);
        router.replace(`/banquets/${r.event.id}`);
        return;
      }
      const r = await api<{ event: EventDTO; clashes: Clash[] }>(`/api/banquets/${id}`, { method: "PATCH", body: toBody(f!) });
      setEvent(r.event);
      setClashes(r.clashes);
      const nf = toForm(r.event, defaults);
      setForm(nf);
      setSaved(JSON.stringify(nf));
      toast("Saved");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: BanquetStatus, extra: Record<string, unknown> = {}) {
    setBusy(status);
    try {
      const r = await api<{ event: EventDTO }>(`/api/banquets/${id}/status`, { body: { status, ...extra } });
      setEvent(r.event);
      const nf = toForm(r.event, defaults);
      setForm(nf);
      setSaved(JSON.stringify(nf));
      const fresh = await api<{ clashes: Clash[] }>(`/api/banquets/${id}`);
      setClashes(fresh.clashes);
      setDialog(null);
      toast(status === "completed" ? `Invoice ${r.event.invoiceNumber} made` : status === "confirmed" ? "Booking confirmed" : status === "cancelled" ? "Booking cancelled" : "Updated");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function removePayment(p: Payment) {
    if (!(await confirm({ title: "Remove this payment?", message: `${label(p.method)} ${formatCurrency(p.amount)} of ${formatDate(p.date)}. Use this only for a payment entered by mistake.`, confirmText: "Remove", danger: true }))) return;
    try {
      const r = await api<{ event: EventDTO; dayClosed: boolean }>(`/api/banquets/${id}/payments/${p.id}`, { method: "DELETE" });
      setEvent(r.event);
      toast(r.dayClosed ? "Removed. That day was already closed: its cash count stays as it was." : "Payment removed", r.dayClosed ? "info" : "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const share = event
    ? `Hello ${event.customerName}, ${event.status === "confirmed" || event.status === "completed" ? "your booking is confirmed" : "here are the details of your enquiry"} at ${shell.restaurantName}:\n` +
      `${event.title || event.eventType} on ${formatDate(event.date)}, ${timeText(event.startTime)}–${timeText(event.endTime)}${event.hall ? ` at ${event.hall.name}` : ""}\n` +
      `${event.totals.plates} plates${event.packageName ? ` (${event.packageName})` : ""} × ${formatCurrency(event.pricePerPlate)}\n` +
      `Total ${formatCurrency(event.totals.total)}${event.paid ? ` · paid ${formatCurrency(event.paid)} · balance ${formatCurrency(event.balance)}` : ""}\n` +
      `Booking #${event.number}. Thank you!`
    : "";

  const actions: Record<BanquetStatus, Array<{ to: BanquetStatus; text: string; variant?: "primary" | "outline" | "success" | "danger" }>> = {
    enquiry: [{ to: "confirmed", text: "Confirm booking", variant: "success" }, { to: "tentative", text: "Hold the hall (tentative)", variant: "outline" }],
    tentative: [{ to: "confirmed", text: "Confirm booking", variant: "success" }, { to: "enquiry", text: "Release hold", variant: "outline" }],
    confirmed: [{ to: "completed", text: "Function done — make invoice", variant: "primary" }, { to: "tentative", text: "Back to tentative", variant: "outline" }],
    completed: [],
    cancelled: [{ to: "enquiry", text: "Open again as enquiry", variant: "outline" }],
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/banquets" className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary-700"><ArrowLeft className="h-4 w-4" /> Banquets</Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
          {isNew ? "New booking" : `${event?.title || event?.eventType} · #${event?.number}`}
          {event && <StatusChip status={event.status} />}
          {event?.invoiceNumber && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-800">Invoice {event.invoiceNumber}</span>}
        </h1>
      </div>
      {event?.status === "cancelled" && <Tip tone="danger">Cancelled{event.cancelReason ? `: ${event.cancelReason}` : ""}.{event.paid > 0 ? ` ${formatCurrency(event.paid)} was paid — record a refund if you return it.` : ""}</Tip>}
      {clashes.length > 0 && !locked && (
        <Tip tone="warning">
          <AlertTriangle className="mr-1 inline h-4 w-4" /> {hall?.name ?? "This hall"} is already held at this time by{" "}
          {clashes.map((c, i) => (
            <span key={c.id}>{i > 0 && ", "}<Link href={`/banquets/${c.id}`} className="font-semibold underline">#{c.number} {c.customerName}</Link> ({timeText(c.startTime)}–{timeText(c.endTime)}, {c.status})</span>
          ))}
          . Change the hall or time before confirming.
        </Tip>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <fieldset disabled={locked} className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={f.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
              <Field label="Phone / WhatsApp"><Input inputMode="tel" value={f.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} /></Field>
              <Field label="Email" optional><Input type="email" value={f.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} /></Field>
              <Field label="Company" optional><Input value={f.company} onChange={(e) => set({ company: e.target.value })} placeholder="For office parties" /></Field>
              <Field label="Company GSTIN" optional hint="Printed on the invoice; counts as B2B in GSTR-1"><Input value={f.customerGstin} maxLength={15} onChange={(e) => set({ customerGstin: e.target.value.toUpperCase().replace(/\s/g, "") })} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Function" />
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Occasion"><Select value={f.eventType} onChange={(e) => set({ eventType: e.target.value })}>{[...new Set([...EVENT_TYPES, f.eventType])].map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Name of the function" optional className="sm:col-span-2"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Riya's 1st birthday" /></Field>
              <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
              <Field label="From"><Input type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
              <Field label="To"><Input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
              <Field label="Hall" className="sm:col-span-3">
                <Select value={f.hallId} onChange={(e) => pickHall(e.target.value)}>
                  <option value="">No hall / not decided</option>
                  {halls.filter((h) => h.active || h.id === f.hallId).map((h) => <option key={h.id} value={h.id}>{h.name} — up to {h.capacity} guests, rent {formatCurrency(h.rent)}</option>)}
                </Select>
              </Field>
              <Field label="Expected guests"><Input type="number" min={1} value={f.guests} onChange={(e) => set({ guests: e.target.value })} /></Field>
              <Field label="Guaranteed plates" hint="Charged at least this many"><Input type="number" min={0} value={f.guaranteedGuests} onChange={(e) => set({ guaranteedGuests: e.target.value })} /></Field>
              <Field label="Count on the day" optional hint="Fill after the function"><Input type="number" min={0} value={f.finalGuests} onChange={(e) => set({ finalGuests: e.target.value })} /></Field>
              {overCapacity && <p className="text-sm font-medium text-amber-700 sm:col-span-3">{hall!.name} holds {hall!.capacity} guests.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Food" description="Per-plate price and the menu printed on the quotation and the kitchen's function sheet." />
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Package" className="sm:col-span-2">
                <Select value={f.packageId} onChange={(e) => pickPackage(e.target.value)}>
                  <option value="">Custom menu</option>
                  {packages.filter((p) => p.active || p.id === f.packageId).map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.pricePerPlate)} a plate</option>)}
                </Select>
              </Field>
              <Field label="Price per plate (₹)"><Input type="number" min={0} value={f.pricePerPlate} onChange={(e) => set({ pricePerPlate: e.target.value })} /></Field>
              <Field label="Menu — one line per course" className="sm:col-span-3"><Textarea rows={6} value={f.menu} onChange={(e) => set({ menu: e.target.value })} placeholder={"Welcome drink: Fresh lime soda\nStarters: Paneer Tikka, Hara Bhara Kebab\nMain course: Paneer Butter Masala, Dal Makhani\nDessert: Gulab Jamun"} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Hall rent, extras and GST" />
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Hall rent (₹)"><Input type="number" min={0} value={f.hallRent} onChange={(e) => set({ hallRent: e.target.value })} /></Field>
                <Field label="Discount (₹)"><Input type="number" min={0} value={f.discount} onChange={(e) => set({ discount: e.target.value })} /></Field>
                <Field label="GST on food (%)"><Input type="number" min={0} max={28} step="0.5" value={f.foodTaxRate} onChange={(e) => set({ foodTaxRate: e.target.value })} /></Field>
                <Field label="GST on rent & extras (%)"><Input type="number" min={0} max={28} step="0.5" value={f.otherTaxRate} onChange={(e) => set({ otherTaxRate: e.target.value })} /></Field>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Extras <span className="font-normal text-slate-500">— decoration, DJ, cake, photographer, extra hours</span></p>
                <div className="space-y-2">
                  {f.extras.map((x, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label="Extra" value={x.name} onChange={(e) => set({ extras: f.extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} placeholder="Balloon decoration" />
                      <Input aria-label="Extra amount" type="number" min={0} value={x.amount} onChange={(e) => set({ extras: f.extras.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)) })} className="w-36" placeholder="₹" />
                      <Button variant="ghost" aria-label="Remove extra" onClick={() => set({ extras: f.extras.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => set({ extras: [...f.extras, { name: "", amount: "" }] })}><Plus className="h-4 w-4" /> Add extra</Button>
                </div>
              </div>
              <Field label="Notes" optional hint="Seating, stage, cake time, special requests — printed on the function sheet"><Textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
            </CardContent>
          </Card>
          {!locked && (
            <div className="flex items-center gap-3">
              <Button size="lg" loading={saving} disabled={!isNew && !dirty} onClick={save}>{isNew ? "Save booking" : "Save changes"}</Button>
              {dirty && !isNew && <span className="text-sm font-medium text-amber-700">Not saved yet</span>}
              {isNew && <span className="text-sm text-slate-500">It is saved as an enquiry. Confirm it once the customer agrees.</span>}
            </div>
          )}
        </fieldset>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Bill" />
            <CardContent className="space-y-1 text-sm">
              <p className="flex justify-between"><span>{totals.plates} plates × {formatCurrency(Number(f.pricePerPlate) || 0)}</span><span>{formatCurrency(totals.food)}</span></p>
              {totals.hallRent > 0 && <p className="flex justify-between"><span>Hall rent</span><span>{formatCurrency(totals.hallRent)}</span></p>}
              {totals.extras > 0 && <p className="flex justify-between"><span>Extras</span><span>{formatCurrency(totals.extras)}</span></p>}
              {totals.discount > 0 && <p className="flex justify-between text-emerald-700"><span>Discount</span><span>−{formatCurrency(totals.discount)}</span></p>}
              {totals.taxLines.filter((l) => l.tax > 0).map((l) => (
                <p key={l.rate} className="flex justify-between text-slate-600"><span>GST {l.rate}% on {formatCurrency(l.taxable)}</span><span>{formatCurrency(l.tax)}</span></p>
              ))}
              {totals.roundOff !== 0 && <p className="flex justify-between text-slate-500"><span>Round off</span><span>{formatCurrency(totals.roundOff)}</span></p>}
              <p className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(totals.total)}</span></p>
              {event && (
                <>
                  <p className="flex justify-between text-emerald-700"><span>Paid</span><span>{formatCurrency(event.paid)}</span></p>
                  <p className={cn("flex justify-between font-bold", event.balance > 0 ? "text-amber-700" : "text-emerald-700")}><span>{event.balance < 0 ? "To refund" : "Balance"}</span><span>{formatCurrency(Math.abs(event.balance))}</span></p>
                  {dirty && <p className="text-xs text-amber-700">Balance is for the saved booking. Save to update it.</p>}
                </>
              )}
            </CardContent>
          </Card>

          {event && (
            <Card>
              <CardHeader title="Status" />
              <CardContent className="grid gap-2">
                {actions[event.status].filter((a) => NEXT_STATUS[event.status].includes(a.to)).map((a) => (
                  <Button key={a.to} variant={a.variant} disabled={dirty || !!busy} loading={busy === a.to} onClick={() => (a.to === "completed" ? (setFinalGuests(f.finalGuests || String(event.guests)), setDialog("complete")) : changeStatus(a.to))}>
                    {a.text}
                  </Button>
                ))}
                {NEXT_STATUS[event.status].includes("cancelled") && <Button variant="ghost" className="text-red-700" disabled={dirty || !!busy} onClick={() => setDialog("cancel")}>Cancel booking</Button>}
                {dirty && <p className="text-xs text-slate-500">Save your changes first.</p>}
                {event.status === "completed" && <p className="text-sm text-slate-600">Invoiced as {event.invoiceNumber}. Details are locked; payments can still be taken.</p>}
              </CardContent>
            </Card>
          )}

          {event && (
            <Card>
              <CardHeader title="Payments" action={event.status !== "cancelled" || event.paid > 0 ? <Button size="sm" variant="success" onClick={() => setDialog("pay")}><Wallet className="h-4 w-4" /> {event.status === "cancelled" ? "Refund" : "Take payment"}</Button> : undefined} />
              <CardContent className="p-0">
                {event.payments.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-slate-500">No money taken yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {event.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 px-5 py-2 text-sm">
                        <span className="flex-1">
                          <b className={p.amount < 0 ? "text-red-700" : ""}>{p.amount < 0 ? "Refund " : ""}{formatCurrency(Math.abs(p.amount))}</b> · {label(p.method)}
                          <span className="block text-xs text-slate-500">{formatDate(p.date)}{p.note ? ` · ${p.note}` : ""}{p.reference ? ` · ${p.reference}` : ""}{p.receivedBy ? ` · ${p.receivedBy}` : ""}</span>
                        </span>
                        {isAdmin && <button aria-label="Remove payment" onClick={() => removePayment(p)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {event && (
            <Card>
              <CardHeader title="Print & share" />
              <CardContent className="grid gap-2">
                <a href={`/print/banquet/${event.id}?kind=quote`} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full justify-start"><FileText className="h-4 w-4" /> Quotation / booking slip</Button></a>
                <a href={`/print/banquet/${event.id}?kind=sheet`} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full justify-start"><Printer className="h-4 w-4" /> Function sheet for kitchen & staff</Button></a>
                {event.invoiceNumber && <a href={`/print/banquet/${event.id}?kind=invoice`} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full justify-start"><FileText className="h-4 w-4" /> Tax invoice {event.invoiceNumber}</Button></a>}
                <a href={whatsappLink(event.customerPhone, share)} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full justify-start text-emerald-700"><MessageCircle className="h-4 w-4" /> Send details on WhatsApp</Button></a>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {dialog === "pay" && event && <PaymentDialog event={event} onClose={() => setDialog(null)} onSaved={(e) => { setEvent(e); setDialog(null); }} />}
      {dialog === "cancel" && event && (
        <Modal open onClose={() => setDialog(null)} title="Cancel this booking?" footer={<><Button variant="outline" onClick={() => setDialog(null)}>Keep it</Button><Button variant="danger" loading={busy === "cancelled"} disabled={!reason.trim()} onClick={() => changeStatus("cancelled", { reason })}>Cancel booking</Button></>}>
          <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Date changed, went elsewhere…" autoFocus /></Field>
          {event.paid > 0 && <p className="mt-3 text-sm text-amber-700">{formatCurrency(event.paid)} was paid. After cancelling, record a refund if you return it.</p>}
        </Modal>
      )}
      {dialog === "complete" && event && (
        <Modal open onClose={() => setDialog(null)} title="Function done — make the invoice" description="The invoice gets its own number (BQ-…) and the booking is locked." footer={<><Button variant="outline" onClick={() => setDialog(null)}>Not yet</Button><Button loading={busy === "completed"} onClick={() => changeStatus("completed", { finalGuests: Number(finalGuests) || 0 })}>Make invoice</Button></>}>
          <Field label="Guests on the day" hint={event.guaranteedGuests ? `At least ${event.guaranteedGuests} plates are charged (guaranteed).` : undefined}>
            <Input type="number" min={0} value={finalGuests} onChange={(e) => setFinalGuests(e.target.value)} autoFocus />
          </Field>
          <p className="mt-3 text-sm text-slate-600">
            Plates charged: <b>{Math.max(Number(finalGuests) || 0, event.guaranteedGuests)}</b> ·{" "}
            Invoice total: <b>{formatCurrency(banquetTotals({ ...event, finalGuests: Number(finalGuests) || 0 }).total)}</b>
          </p>
        </Modal>
      )}
    </div>
  );
}
