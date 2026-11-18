"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Armchair, BellRing, Bike, CalendarClock, Plus, QrCode, ShoppingBag, Split } from "lucide-react";
import { Button, EmptyState, Loading, PageHeader, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { ding } from "@/lib/ding";
import { cn, formatCurrency, label, minutesSince } from "@/lib/utils";
import { minutesOf, timeLabel } from "@/lib/reservations";
import type { OrderSummary, TableDTO } from "@/lib/types";

interface PosData {
  today: string;
  tables: Array<TableDTO & { order: OrderSummary | null; extraBills: number }>;
  otherOrders: OrderSummary[];
  bookings: Array<{ id: string; name: string; guests: number; time: string; tableId: string | null; status: string }>;
  stats: { hidden: boolean; sales: number; bills: number; guests: number; running: number; runningValue: number };
  lowStock: string[];
}

// Status shows as a coloured strip along the top of the tile and a tinted body, as on other POS floor plans.
const STATUS_STYLE: Record<string, string> = {
  free: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
  open: "border-amber-300 bg-amber-50/70 hover:border-amber-400 before:bg-amber-400",
  billed: "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 before:bg-emerald-500",
};

function Figure({ label: l, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[13px] font-medium text-slate-500">{l}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" /> Free</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Running</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Bill printed</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" /> Reserved soon</span>
    </div>
  );
}

function OrderCard({ o, now }: { o: OrderSummary; now: number }) {
  const Icon = o.type === "delivery" ? Bike : o.type === "dine_in" ? Split : ShoppingBag;
  return (
    <Link
      href={`/orders/${o.id}`}
      className={cn("relative flex flex-col gap-1 overflow-hidden rounded-lg border p-3 pt-3.5 text-[13px] transition before:absolute before:inset-x-0 before:top-0 before:h-1", STATUS_STYLE[o.status] ?? STATUS_STYLE.open)}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4" /> #{o.number}
        </span>
        <span className="text-xs text-slate-500">{minutesSince(o.createdAt, now)}</span>
      </span>
      <span className="truncate text-slate-600">{o.customerName || (o.splitOf ? `${o.splitOf} · separate bill` : label(o.type))}</span>
      {o.deliveryStatus === "out" && <span className="truncate text-xs font-semibold text-sky-700">{o.riderName ? `Out with ${o.riderName}` : "Out for delivery"}</span>}
      {o.deliveryStatus === "delivered" && <span className="truncate text-xs font-semibold text-emerald-700">Delivered</span>}
      {o.type === "delivery" && !o.deliveryStatus && o.riderName && <span className="truncate text-xs text-slate-500">Rider: {o.riderName}</span>}
      {o.source !== "counter" && (
        <span className="truncate text-xs font-medium text-violet-700">
          {label(o.source)}
          {o.sourceRef ? ` #${o.sourceRef}` : ""}
        </span>
      )}
      <span className="flex items-center justify-between text-sm">
        <b className="font-semibold">{formatCurrency(o.total)}</b>
        {o.ready > 0 && <span className="rounded bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">{o.ready} ready</span>}
        {o.unsent > 0 && <span className="rounded bg-red-600 px-1.5 text-[11px] font-semibold text-white">{o.unsent} new</span>}
      </span>
    </Link>
  );
}

export default function TablesPage() {
  const { isAdmin, toast, settings } = useApp();
  const [data, setData] = useState<PosData | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const alerts = useRef<string | null>(null);

  const load = useCallback(() => {
    api<PosData>("/api/pos").then(
      (d) => {
        setData(d);
        setError("");
        // Ding when a guest calls or orders from a table QR code since the last look.
        const key = [
          ...d.tables.flatMap((t) => [t.callType ? `${t.id}:${t.callType}:${t.callAt}` : "", t.order?.guestNew ? `${t.order.id}:${t.order.guestNew}` : ""]),
          ...d.otherOrders.map((o) => (o.guestNew ? `${o.id}:${o.guestNew}` : "")),
          ...d.bookings.map((b) => (b.status === "requested" ? `b:${b.id}` : "")),
        ]
          .filter(Boolean)
          .join("|");
        if (alerts.current !== null && key && key !== alerts.current && key.split("|").some((k) => !alerts.current!.includes(k))) ding();
        alerts.current = key;
      },
      (e) => setError(e.message)
    );
  }, []);

  useEffect(() => {
    load();
    // Other tills, captains' phones and QR orders change the floor too; keep it fresh.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
      setNow(Date.now());
    }, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function answer(tableId: string) {
    try {
      await api(`/api/tables/${tableId}/call`, { method: "DELETE" });
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const areas = useMemo(() => {
    const map = new Map<string, PosData["tables"]>();
    for (const t of data?.tables ?? []) map.set(t.area, [...(map.get(t.area) ?? []), t]);
    return [...map.entries()];
  }, [data]);

  if (error && !data) return <Tip tone="danger">{error}</Tip>;
  if (!data) return <Loading />;
  const s = data.stats;
  const calls = data.tables.filter((t) => t.callType);
  // Bookings coming up in the next 2 hours mark their table as reserved.
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: settings.timezone }).format(now).split(":");
  const nowMin = Number(clock[0]) * 60 + Number(clock[1]);
  const reservedFor = (tableId: string) => data.bookings.find((b) => b.tableId === tableId && minutesOf(b.time) - nowMin <= 120 && minutesOf(b.time) - nowMin >= -45);
  const requests = data.bookings.filter((b) => b.status === "requested").length;
  const qrOrders = data.tables.filter((t) => t.order && t.order.guestNew > 0);
  const onlineOrders = data.otherOrders.filter((o) => o.guestNew > 0);
  const timeOf = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: settings.timezone }).format(new Date(iso));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tables"
        description="Choose a table to take an order. Running tables show the amount so far."
        actions={
          <>
            <Link href="/reservations">
              <Button variant="outline">
                <CalendarClock /> Bookings{data.bookings.length ? ` · ${data.bookings.length}` : ""}
              </Button>
            </Link>
            <Link href="/orders/new?type=takeaway">
              <Button variant="outline">
                <ShoppingBag /> New takeaway
              </Button>
            </Link>
            <Link href="/orders/new?type=delivery">
              <Button variant="outline">
                <Bike /> New delivery
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-4 lg:divide-x [&>*]:border-slate-200 max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r">
        {!s.hidden && <Figure label="Sales today" value={formatCurrency(s.sales)} note="Paid bills" />}
        <Figure label="Bills today" value={String(s.bills)} note={s.guests ? `${s.guests} guests` : "No guests yet"} />
        <Figure label="Running orders" value={String(s.running)} note={s.running ? (s.hidden ? "Not yet paid" : `${formatCurrency(s.runningValue)} not yet paid`) : "None right now"} />
        <Figure label="Tables in use" value={`${data.tables.filter((t) => t.order).length} of ${data.tables.length}`} note={`${data.tables.filter((t) => !t.order).length} free`} />
      </div>

      {(() => {
        const items: Array<{ key: string; tone: "red" | "violet" | "amber"; icon: React.ReactNode; text: React.ReactNode; actions: React.ReactNode }> = [
          ...calls.map((t) => ({
            key: `call-${t.id}`,
            tone: "red" as const,
            icon: <BellRing className="h-4 w-4" />,
            text: (
              <>
                <b className="font-semibold">Table {t.name}</b> {t.callType === "bill" ? "asked for the bill" : t.callType === "paid" ? "says they paid by UPI — check your UPI app, then take the payment" : "is calling a waiter"}
                {t.callAt && <span className="text-slate-500"> · {minutesSince(t.callAt, now)} ago</span>}
              </>
            ),
            actions: (
              <>
                {t.order && (
                  <Link href={`/orders/${t.order.id}`}>
                    <Button size="sm" variant="outline">Open order</Button>
                  </Link>
                )}
                <Button size="sm" onClick={() => answer(t.id)}>Done</Button>
              </>
            ),
          })),
          ...qrOrders.map((t) => ({
            key: `qr-${t.id}`,
            tone: "violet" as const,
            icon: <QrCode className="h-4 w-4" />,
            text: (
              <>
                <b className="font-semibold">Table {t.name}</b> ordered {t.order!.guestNew} dish{t.order!.guestNew === 1 ? "" : "es"} from the QR menu. Check and send to the kitchen.
              </>
            ),
            actions: (
              <Link href={`/orders/${t.order!.id}`}>
                <Button size="sm">Open</Button>
              </Link>
            ),
          })),
          ...onlineOrders.map((o) => ({
            key: `online-${o.id}`,
            tone: "violet" as const,
            icon: o.type === "delivery" ? <Bike className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />,
            text: (
              <>
                <b className="font-semibold">
                  New {o.source === "website" ? "online " : ["zomato", "swiggy"].includes(o.source) ? `${label(o.source)} ` : ""}
                  {label(o.type).toLowerCase()} order #{o.number}
                </b>
                {o.customerName ? ` from ${o.customerName}` : ""} · {formatCurrency(o.total)}
                {o.scheduledFor && <span className="text-slate-500"> · for {timeOf(o.scheduledFor)}</span>}. {["zomato", "swiggy"].includes(o.source) ? "Open it and accept it." : "Check it and send it to the kitchen."}
              </>
            ),
            actions: (
              <Link href={`/orders/${o.id}`}>
                <Button size="sm">Open</Button>
              </Link>
            ),
          })),
          ...(requests > 0
            ? [
                {
                  key: "requests",
                  tone: "amber" as const,
                  icon: <CalendarClock className="h-4 w-4" />,
                  text: (
                    <>
                      <b className="font-semibold">
                        {requests} table booking request{requests === 1 ? "" : "s"}
                      </b>{" "}
                      from your booking link to confirm.
                    </>
                  ),
                  actions: (
                    <Link href="/reservations">
                      <Button size="sm" variant="outline">Review</Button>
                    </Link>
                  ),
                },
              ]
            : []),
          ...(isAdmin && data.lowStock.length > 0
            ? [
                {
                  key: "stock",
                  tone: "amber" as const,
                  icon: <AlertTriangle className="h-4 w-4" />,
                  text: (
                    <>
                      <b className="font-semibold">Running low:</b> {data.lowStock.slice(0, 6).join(", ")}
                      {data.lowStock.length > 6 && ` and ${data.lowStock.length - 6} more`}
                    </>
                  ),
                  actions: (
                    <Link href="/stock">
                      <Button size="sm" variant="outline">Stock</Button>
                    </Link>
                  ),
                },
              ]
            : []),
        ];
        if (!items.length) return null;
        const tone = { red: "bg-red-50 text-red-600 ring-red-600/15", violet: "bg-violet-50 text-violet-600 ring-violet-600/15", amber: "bg-amber-50 text-amber-600 ring-amber-600/20" };
        return (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Needs attention">
            <h2 className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-900">
              Needs attention <span className="rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{items.length}</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {items.map((i) => (
                <li key={i.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", tone[i.tone], i.tone === "red" && "animate-pulse")}>{i.icon}</span>
                  <p className="min-w-0 flex-1 text-sm text-slate-700">{i.text}</p>
                  <div className="flex gap-2">{i.actions}</div>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {data.otherOrders.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {data.otherOrders.some((o) => o.type === "dine_in") ? "Takeaway, delivery & separate bills" : "Takeaway & delivery"}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {data.otherOrders.map((o) => (
              <OrderCard key={o.id} o={o} now={now} />
            ))}
          </div>
        </section>
      )}

      {data.tables.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-6 w-6" />}
          title="No tables yet"
          description={isAdmin ? "Add your tables once and they appear here. You can still take takeaway and delivery orders." : "Ask the owner to add tables in Table setup."}
          action={
            isAdmin && (
              <Link href="/tables">
                <Button>
                  <Plus className="h-4 w-4" /> Add tables
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <Legend />
          {areas.map(([area, tables]) => (
            <section key={area}>
              <h2 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {area}
                <span className="font-normal normal-case tracking-normal text-slate-400">
                  {tables.filter((t) => t.order).length} of {tables.length} in use
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-8">
                {tables.map((t) => {
                  const o = t.order;
                  const booking = !o ? reservedFor(t.id) : undefined;
                  return (
                    <Link
                      key={t.id}
                      href={o ? `/orders/${o.id}` : `/orders/new?type=dine_in&table=${t.id}`}
                      className={cn(
                        "relative flex aspect-[5/4] flex-col items-center justify-center overflow-hidden rounded-lg border p-2 text-center transition before:absolute before:inset-x-0 before:top-0 before:h-1",
                        STATUS_STYLE[o?.status ?? "free"],
                        booking && "border-violet-300 bg-violet-50/70 before:bg-violet-400"
                      )}
                    >
                      {t.callType && (
                        <span className="absolute bottom-1.5 right-1.5 animate-pulse rounded bg-red-600 p-1 text-white" title={t.callType === "bill" ? "Asked for the bill" : "Calling a waiter"}>
                          <BellRing className="h-3 w-3" />
                        </span>
                      )}
                      {o && o.ready > 0 && (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-600 px-1.5 text-[11px] font-semibold text-white" title="Dishes ready in the kitchen">
                          {o.ready} ready
                        </span>
                      )}
                      {o && o.unsent > 0 && (
                        <span className="absolute right-1.5 top-2 rounded bg-red-600 px-1.5 text-[11px] font-semibold text-white" title="Items not sent to the kitchen">
                          {o.unsent}
                        </span>
                      )}
                      {t.extraBills > 0 && (
                        <span className="absolute left-1.5 top-2 rounded bg-sky-600 px-1.5 text-[11px] font-semibold text-white" title="Separate bills for this table">
                          +{t.extraBills} bill
                        </span>
                      )}
                      <span className="text-lg font-semibold text-slate-900">{t.name}</span>
                      {o ? (
                        <>
                          <span className="text-sm font-medium text-slate-800">{formatCurrency(o.total)}</span>
                          <span className="text-xs text-slate-500">{o.status === "billed" ? "Bill printed" : minutesSince(o.createdAt, now)}</span>
                        </>
                      ) : booking ? (
                        <span className="text-xs font-medium text-violet-700" title={`${booking.name}, ${booking.guests} guests`}>
                          Reserved {timeLabel(booking.time)}
                          <span className="block truncate font-normal">{booking.name} ({booking.guests})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">{t.seats} seats</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
