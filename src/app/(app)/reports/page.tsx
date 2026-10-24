"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Download, IndianRupee, Percent, ReceiptText, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, CardContent, CardHeader, EmptyState, Input, Loading, PageHeader, StatCard, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { SalesReport } from "@/lib/reports";

type Report = Omit<SalesReport, "cancelled"> & {
  cancelled: { count: number; value: number; orders: Array<{ id: string; number: number; billNumber: string | null; total: number; cancelReason: string | null; cancelledAt: string | null; createdByName: string | null; table: { name: string } | null }> };
};

const SERIES = "#ea580c";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

function compact(n: number) {
  if (n >= 100000) return `${Math.round(n / 1000) / 100}L`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(Math.round(n));
}

function ColumnChart({ data, xKey, xFormat, height = 240 }: { data: Array<Record<string, number | string>>; xKey: string; xFormat: (v: string | number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey={xKey} tickFormatter={xFormat} tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={12} />
        <YAxis tickFormatter={compact} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { sales: number; bills: number } & Record<string, string | number>;
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                <p className="font-semibold text-slate-900">{xFormat(row[xKey])}</p>
                <p className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES }} /> {formatCurrency(row.sales)}
                </p>
                <p className="text-slate-500">{row.bills} bill(s)</p>
              </div>
            );
          }}
        />
        <Bar dataKey="sales" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A table row with a thin bar showing its share, so the biggest rows stand out. */
function ShareRow({ name, value, share, sub }: { name: React.ReactNode; value: string; share: number; sub?: string }) {
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3 text-[15px]">
        <span className="min-w-0 truncate text-slate-800">{name}</span>
        <span className="shrink-0 text-right">
          <b className="text-slate-900">{value}</b>
          {sub && <span className="ml-2 text-sm text-slate-500">{sub}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, Math.min(100, share * 100))}%`, background: SERIES }} />
      </div>
    </li>
  );
}

export default function ReportsPage() {
  const { settings, isAdmin } = useApp();
  const [from, setFrom] = useState(addDays(settings.today, -6));
  const [to, setTo] = useState(settings.today);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    setData(null);
    api<Report>(`/api/reports?from=${from}&to=${to}`).then(setData, (e) => setError(e.message));
  }, [from, to, isAdmin]);

  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can see reports.</Tip>;

  const presets = [
    { label: "Today", from: settings.today, to: settings.today },
    { label: "Yesterday", from: addDays(settings.today, -1), to: addDays(settings.today, -1) },
    { label: "Last 7 days", from: addDays(settings.today, -6), to: settings.today },
    { label: "Last 30 days", from: addDays(settings.today, -29), to: settings.today },
    { label: "This month", from: `${settings.today.slice(0, 7)}-01`, to: settings.today },
  ];
  const download = (type: string) => `/api/reports/export?type=${type}&from=${from}&to=${to}`;
  const shortDay = (v: string | number) => formatDate(String(v)).replace(/ \d{4}$/, "");
  const hourLabel = (v: string | number) => {
    const h = Number(v);
    return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="How much you sold, what sold best and how people paid. Only paid bills are counted." />

      <Card className="flex flex-wrap items-end gap-2 p-4">
        {presets.map((p) => (
          <Button key={p.label} size="sm" variant={from === p.from && to === p.to ? "primary" : "outline"} onClick={() => (setFrom(p.from), setTo(p.to))}>
            {p.label}
          </Button>
        ))}
        <label className="text-sm text-slate-600">
          From <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
        </label>
        <label className="text-sm text-slate-600">
          To <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
        </label>
      </Card>

      {error && <Tip tone="danger">{error}</Tip>}
      {!data ? (
        !error && <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Sales" value={formatCurrency(data.totals.sales)} subtitle={`${data.totals.bills} bills`} icon={<IndianRupee className="h-5 w-5" />} tone="green" />
            <StatCard title="Average bill" value={formatCurrency(data.totals.averageBill)} subtitle={data.totals.guests ? `${data.totals.guests} guests` : undefined} icon={<ReceiptText className="h-5 w-5" />} tone="sky" />
            <StatCard title="Discounts given" value={formatCurrency(data.totals.discount)} subtitle={`Tax collected ${formatCurrency(data.totals.tax)}`} icon={<Percent className="h-5 w-5" />} tone="amber" />
            <StatCard
              title="Cancelled"
              value={data.cancelled.count}
              subtitle={data.cancelled.count ? `worth ${formatCurrency(data.cancelled.value)}` : "None"}
              icon={<Ban className="h-5 w-5" />}
              tone={data.cancelled.count ? "red" : "slate"}
            />
          </div>

          {data.totals.bills === 0 ? (
            <EmptyState title="No paid bills in this period" description="Pick another date range above." />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader title="Sales by day" description={`${formatDate(from)} – ${formatDate(to)}`} action={<a href={download("daily")}><Button size="sm" variant="outline"><Download className="h-4 w-4" /> CSV</Button></a>} />
                  <CardContent>
                    <ColumnChart data={data.daily} xKey="date" xFormat={shortDay} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="Busy hours" description="Sales by the hour bills were paid" />
                  <CardContent>
                    <ColumnChart data={data.hourly} xKey="hour" xFormat={hourLabel} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader title="Payment modes" />
                  <CardContent>
                    <ul>
                      {data.payments.map((p) => (
                        <ShareRow key={p.method} name={label(p.method)} value={formatCurrency(p.amount)} sub={`${p.count}×`} share={p.amount / data.totals.sales} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="Order types" />
                  <CardContent>
                    <ul>
                      {data.byType.map((t) => (
                        <ShareRow key={t.type} name={label(t.type)} value={formatCurrency(t.sales)} sub={`${t.bills} bills`} share={t.sales / data.totals.sales} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                {data.bySource.some((x) => x.source !== "counter") && (
                  <Card>
                    <CardHeader title="Order sources" description="Walk-in, phone, Zomato, Swiggy, QR…" />
                    <CardContent>
                      <ul>
                        {data.bySource.map((x) => (
                          <ShareRow key={x.source} name={label(x.source)} value={formatCurrency(x.sales)} sub={`${x.bills} bills`} share={x.sales / data.totals.sales} />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader title="Sales by staff" description="Who opened the order" />
                  <CardContent>
                    <ul>
                      {data.staff.map((s) => (
                        <ShareRow key={s.name} name={s.name} value={formatCurrency(s.sales)} sub={`${s.bills} bills`} share={s.sales / data.totals.sales} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Best-selling dishes" description="By quantity, at menu price" action={<a href={download("items")}><Button size="sm" variant="outline"><Download className="h-4 w-4" /> CSV</Button></a>} />
                  <CardContent>
                    <ol>
                      {data.topItems.slice(0, 15).map((i, n) => (
                        <ShareRow
                          key={i.name}
                          name={<><span className="mr-2 text-slate-400">{n + 1}.</span>{i.name} <span className="text-sm text-slate-400">· {i.category}</span></>}
                          value={`${i.quantity} sold`}
                          sub={formatCurrency(i.amount)}
                          share={i.quantity / data.topItems[0].quantity}
                        />
                      ))}
                    </ol>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="Sales by category" description="At menu price, before discount and tax" />
                  <CardContent>
                    <ul>
                      {data.categories.map((c) => (
                        <ShareRow key={c.category} name={c.category} value={formatCurrency(c.amount)} sub={`${c.quantity} items`} share={c.amount / data.categories[0].amount} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {data.expenses.total > 0 && (
                <Card>
                  <CardHeader
                    title="Expenses"
                    description={`Sales ${formatCurrency(data.totals.sales)} − expenses ${formatCurrency(data.expenses.total)} = ${formatCurrency(data.totals.sales - data.expenses.total)}`}
                    action={
                      <Link href="/cash">
                        <Button size="sm" variant="outline">Cash & expenses</Button>
                      </Link>
                    }
                  />
                  <CardContent>
                    <ul className="grid gap-x-8 sm:grid-cols-2">
                      {data.expenses.byCategory.map((e) => (
                        <ShareRow key={e.category} name={e.category} value={formatCurrency(e.amount)} share={e.amount / data.expenses.byCategory[0].amount} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Tax summary" description="For your GST / tax return" action={<a href={download("tax")}><Button size="sm" variant="outline"><Download className="h-4 w-4" /> CSV</Button></a>} />
                  <CardContent className="overflow-x-auto">
                    {data.taxes.length === 0 ? (
                      <p className="text-slate-500">No tax was charged in this period.</p>
                    ) : (
                      <table className="w-full text-[15px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                            <th className="py-2 font-semibold">Rate</th>
                            <th className="py-2 text-right font-semibold">Taxable value</th>
                            <th className="py-2 text-right font-semibold">Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.taxes.map((t) => (
                            <tr key={t.rate} className="border-b border-slate-100">
                              <td className="py-2">{t.rate}%</td>
                              <td className="py-2 text-right">{formatCurrency(t.taxable)}</td>
                              <td className="py-2 text-right">{formatCurrency(t.tax)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total</td>
                            <td className="py-2 text-right">{formatCurrency(data.taxes.reduce((s, t) => s + t.taxable, 0))}</td>
                            <td className="py-2 text-right">{formatCurrency(data.totals.tax)}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    <div className="mt-4 space-y-1 text-sm text-slate-600">
                      <p>Items at menu price: <b>{formatCurrency(data.totals.itemsTotal)}</b></p>
                      <p>
                        Discounts: <b>{formatCurrency(data.totals.discount)}</b>
                        {data.totals.pointsDiscount > 0 && <> (incl. loyalty points {formatCurrency(data.totals.pointsDiscount)})</>} · Service charge:{" "}
                        <b>{formatCurrency(data.totals.serviceCharge)}</b> · Packing & delivery: <b>{formatCurrency(data.totals.charges)}</b> · Round off:{" "}
                        <b>{formatCurrency(data.totals.roundOff)}</b>
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader title="All bills" description="Every paid bill with its tax and payment, for your accountant" />
                  <CardContent className="space-y-3">
                    <a href={download("bills")}>
                      <Button variant="outline"><Download className="h-4 w-4" /> Download bills (CSV for Excel)</Button>
                    </a>
                    {data.cancelled.count > 0 && (
                      <div>
                        <p className="mb-1 text-sm font-semibold text-slate-700">Cancelled orders</p>
                        <ul className="divide-y divide-slate-100 text-sm">
                          {data.cancelled.orders.map((o) => (
                            <li key={o.id} className="py-1.5">
                              <b>{o.billNumber ? `Bill ${o.billNumber}` : `Order #${o.number}`}</b>
                              {o.table && ` · ${o.table.name}`} · {formatCurrency(o.total)}
                              <span className="text-slate-500"> · {o.cancelReason}{o.cancelledAt && ` · ${formatDateTime(o.cancelledAt, settings.timezone)}`}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-sm text-slate-500"><Users className="h-4 w-4" /> See who cancelled or discounted in Settings → Activity history.</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
