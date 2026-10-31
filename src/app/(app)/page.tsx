"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Armchair, BellRing, Bike, CalendarClock, ChefHat, IndianRupee, Plus, QrCode, ReceiptText, ShoppingBag, Split, Users } from "lucide-react";
import { Button, EmptyState, Loading, PageHeader, StatCard, Tip } from "@/components/ui";
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

const STATUS_STYLE: Record<string, string> = {
  free: "border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/40",
  open: "border-amber-300 bg-amber-50 hover:border-amber-400",
  billed: "border-emerald-400 bg-emerald-50 hover:border-emerald-500",
};

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-300 bg-white" /> Free</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Running</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-emerald-400 bg-emerald-100" /> Bill printed, waiting for payment</span>
    </div>
  );
}

function OrderCard({ o, now }: { o: OrderSummary; now: number }) {
  const Icon = o.type === "delivery" ? Bike : o.type === "dine_in" ? Split : ShoppingBag;
  return (
    <Link
      href={`/orders/${o.id}`}
      className={cn("flex flex-col gap-1 rounded-2xl border-2 p-3 transition", STATUS_STYLE[o.status] ?? STATUS_STYLE.open)}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-900">
          <Icon className="h-4 w-4" /> #{o.number}
        </span>
        <span className="text-xs text-slate-500">{minutesSince(o.createdAt, now)}</span>
      </span>
      <span className="truncate text-sm text-slate-600">{o.customerName || (o.splitOf ? `${o.splitOf} · separate bill` : label(o.type))}</span>
      {o.deliveryStatus === "out" && <span className="truncate text-xs font-semibold text-sky-700">{o.riderName ? `Out with ${o.riderName}` : "Out for delivery"}</span>}
      {o.deliveryStatus === "delivered" && <span className="truncate text-xs font-semibold text-emerald-700">Delivered</span>}
      {o.type === "delivery" && !o.deliveryStatus && o.riderName && <span className="truncate text-xs text-slate-500">Rider: {o.riderName}</span>}
      {o.source !== "counter" && (
        <span className="truncate text-xs font-semibold text-violet-700">
          {label(o.source)}
          {o.sourceRef ? ` #${o.sourceRef}` : ""}
        </span>
      )}
      <span className="flex items-center justify-between text-sm">
        <b>{formatCurrency(o.total)}</b>
        {o.ready > 0 && <span className="rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">{o.ready} ready</span>}
        {o.unsent > 0 && <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{o.unsent} new</span>}
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
    <div className="space-y-6">
      <PageHeader
        title="Tables"
        description="Tap a table to take an order. Running tables show the amount so far."
        actions={
          <>
            <Link href="/reservations">
              <Button variant="outline">
                <CalendarClock className="h-5 w-5" /> Bookings{data.bookings.length ? ` (${data.bookings.length})` : ""}
              </Button>
            </Link>
            <Link href="/orders/new?type=takeaway">
              <Button variant="outline">
                <ShoppingBag className="h-5 w-5" /> New takeaway
              </Button>
            </Link>
            <Link href="/orders/new?type=delivery">
              <Button variant="outline">
                <Bike className="h-5 w-5" /> New delivery
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!s.hidden && <StatCard title="Sales today" value={formatCurrency(s.sales)} subtitle="Paid bills" icon={<IndianRupee className="h-5 w-5" />} tone="green" />}
        <StatCard title="Bills today" value={s.bills} subtitle={s.guests ? `${s.guests} guests` : undefined} icon={<ReceiptText className="h-5 w-5" />} tone="sky" />
        <StatCard title="Running orders" value={s.running} subtitle={s.running ? (s.hidden ? "Not yet paid" : `${formatCurrency(s.runningValue)} not yet paid`) : "None right now"} icon={<ChefHat className="h-5 w-5" />} tone="amber" />
        <StatCard
          title="Tables in use"
          value={`${data.tables.filter((t) => t.order).length} / ${data.tables.length}`}
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
      </div>

      {isAdmin && data.lowStock.length > 0 && (
        <Link href="/stock" className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:border-amber-300">
          <b>Running low:</b> {data.lowStock.slice(0, 6).join(", ")}
          {data.lowStock.length > 6 && ` and ${data.lowStock.length - 6} more`}. Tap to see stock.
        </Link>
      )}

      {requests > 0 && (
        <Link href="/reservations" className="flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
          <CalendarClock className="h-6 w-6 text-amber-700" />
          <p className="flex-1 font-semibold text-amber-900">
            {requests} table booking request{requests === 1 ? "" : "s"} from your booking link. Confirm {requests === 1 ? "it" : "them"}.
          </p>
          <Button size="sm">Open</Button>
        </Link>
      )}

      {onlineOrders.length > 0 && (
        <section className="space-y-2">
          {onlineOrders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-violet-300 bg-violet-50 px-4 py-3">
              {o.type === "delivery" ? <Bike className="h-6 w-6 text-violet-700" /> : <ShoppingBag className="h-6 w-6 text-violet-700" />}
              <p className="flex-1 font-semibold text-violet-900">
                New {o.source === "website" ? "online" : ""} {label(o.type).toLowerCase()} order #{o.number}
                {o.customerName ? ` from ${o.customerName}` : ""} · {formatCurrency(o.total)}
                {o.scheduledFor && <span className="font-normal"> · for {timeOf(o.scheduledFor)}</span>}. Check it and send it to the kitchen to accept.
              </p>
              <Button size="sm">Open</Button>
            </Link>
          ))}
        </section>
      )}

      {(calls.length > 0 || qrOrders.length > 0) && (
        <section className="space-y-2">
          {calls.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
              <BellRing className="h-6 w-6 animate-pulse text-red-600" />
              <p className="flex-1 font-semibold text-red-900">
                Table {t.name} {t.callType === "bill" ? "asked for the bill" : t.callType === "paid" ? "says they paid by UPI — check your UPI app, then take the payment" : "is calling a waiter"}
                {t.callAt && <span className="font-normal text-red-700"> · {minutesSince(t.callAt, now)} ago</span>}
              </p>
              {t.order && (
                <Link href={`/orders/${t.order.id}`}>
                  <Button size="sm" variant="outline">Open order</Button>
                </Link>
              )}
              <Button size="sm" variant="danger" onClick={() => answer(t.id)}>
                Done
              </Button>
            </div>
          ))}
          {qrOrders.map((t) => (
            <Link key={t.id} href={`/orders/${t.order!.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-violet-300 bg-violet-50 px-4 py-3">
              <QrCode className="h-6 w-6 text-violet-700" />
              <p className="flex-1 font-semibold text-violet-900">
                Table {t.name} ordered {t.order!.guestNew} dish{t.order!.guestNew === 1 ? "" : "es"} from the QR menu. Check and send to the kitchen.
              </p>
              <Button size="sm">Open</Button>
            </Link>
          ))}
        </section>
      )}

      {data.otherOrders.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
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
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{area}</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-8">
                {tables.map((t) => {
                  const o = t.order;
                  const booking = !o ? reservedFor(t.id) : undefined;
                  return (
                    <Link
                      key={t.id}
                      href={o ? `/orders/${o.id}` : `/orders/new?type=dine_in&table=${t.id}`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition",
                        STATUS_STYLE[o?.status ?? "free"],
                        booking && "border-violet-300 bg-violet-50"
                      )}
                    >
                      {t.callType && (
                        <span className="absolute bottom-1.5 right-1.5 animate-pulse rounded-full bg-red-600 p-1 text-white" title={t.callType === "bill" ? "Asked for the bill" : "Calling a waiter"}>
                          <BellRing className="h-3 w-3" />
                        </span>
                      )}
                      {o && o.ready > 0 && (
                        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2 text-[11px] font-bold text-white" title="Dishes ready in the kitchen">
                          {o.ready} ready
                        </span>
                      )}
                      {o && o.unsent > 0 && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white" title="Items not sent to the kitchen">
                          {o.unsent}
                        </span>
                      )}
                      {t.extraBills > 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-sky-600 px-1.5 text-[11px] font-bold text-white" title="Separate bills for this table">
                          +{t.extraBills} bill
                        </span>
                      )}
                      <span className="text-xl font-bold text-slate-900">{t.name}</span>
                      {o ? (
                        <>
                          <span className="text-sm font-semibold text-slate-800">{formatCurrency(o.total)}</span>
                          <span className="text-xs text-slate-500">{o.status === "billed" ? "Bill printed" : minutesSince(o.createdAt, now)}</span>
                        </>
                      ) : booking ? (
                        <span className="text-xs font-semibold text-violet-700" title={`${booking.name}, ${booking.guests} guests`}>
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
