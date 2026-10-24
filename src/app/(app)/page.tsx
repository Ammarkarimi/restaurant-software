"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Armchair, Bike, ChefHat, IndianRupee, Plus, ReceiptText, ShoppingBag, Split, Users } from "lucide-react";
import { Button, EmptyState, Loading, PageHeader, StatCard, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { cn, formatCurrency, label, minutesSince } from "@/lib/utils";
import type { OrderSummary, TableDTO } from "@/lib/types";

interface PosData {
  today: string;
  tables: Array<TableDTO & { order: OrderSummary | null; extraBills: number }>;
  otherOrders: OrderSummary[];
  stats: { sales: number; bills: number; guests: number; running: number; runningValue: number };
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
      {o.source !== "counter" && (
        <span className="truncate text-xs font-semibold text-violet-700">
          {label(o.source)}
          {o.sourceRef ? ` #${o.sourceRef}` : ""}
        </span>
      )}
      <span className="flex items-center justify-between text-sm">
        <b>{formatCurrency(o.total)}</b>
        {o.unsent > 0 && <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{o.unsent} new</span>}
      </span>
    </Link>
  );
}

export default function TablesPage() {
  const { isAdmin } = useApp();
  const [data, setData] = useState<PosData | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    api<PosData>("/api/pos").then(
      (d) => {
        setData(d);
        setError("");
      },
      (e) => setError(e.message)
    );
  }, []);

  useEffect(() => {
    load();
    // Other tills and captains' phones change orders too; keep the floor fresh.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
      setNow(Date.now());
    }, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const areas = useMemo(() => {
    const map = new Map<string, PosData["tables"]>();
    for (const t of data?.tables ?? []) map.set(t.area, [...(map.get(t.area) ?? []), t]);
    return [...map.entries()];
  }, [data]);

  if (error && !data) return <Tip tone="danger">{error}</Tip>;
  if (!data) return <Loading />;
  const s = data.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tables"
        description="Tap a table to take an order. Running tables show the amount so far."
        actions={
          <>
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
        <StatCard title="Sales today" value={formatCurrency(s.sales)} subtitle="Paid bills" icon={<IndianRupee className="h-5 w-5" />} tone="green" />
        <StatCard title="Bills today" value={s.bills} subtitle={s.guests ? `${s.guests} guests` : undefined} icon={<ReceiptText className="h-5 w-5" />} tone="sky" />
        <StatCard title="Running orders" value={s.running} subtitle={s.running ? `${formatCurrency(s.runningValue)} not yet paid` : "None right now"} icon={<ChefHat className="h-5 w-5" />} tone="amber" />
        <StatCard
          title="Tables in use"
          value={`${data.tables.filter((t) => t.order).length} / ${data.tables.length}`}
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
      </div>

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
                  return (
                    <Link
                      key={t.id}
                      href={o ? `/orders/${o.id}` : `/orders/new?type=dine_in&table=${t.id}`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition",
                        STATUS_STYLE[o?.status ?? "free"]
                      )}
                    >
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
