"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Printer, ReceiptText, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Loading, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { formatCurrency, formatDate, formatTime, label } from "@/lib/utils";

interface Row {
  id: string;
  number: number;
  billNumber: string | null;
  type: string;
  status: string;
  table: { name: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  settledAt: string | null;
  createdByName: string | null;
  itemCount: number;
  total: number;
  methods: string[];
  cancelReason: string | null;
}

type Status = "all" | "running" | "settled" | "cancelled";

export default function BillsPage() {
  const { settings } = useApp();
  const [from, setFrom] = useState(settings.today);
  const [to, setTo] = useState(settings.today);
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ from, to });
    if (status !== "all") p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    api<{ orders: Row[] }>(`/api/orders?${p}`).then((r) => setRows(r.orders), () => setRows([]));
  }, [from, to, status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const paid = (rows ?? []).filter((r) => r.status === "settled");
  const quick = [
    { label: "Today", from: settings.today, to: settings.today },
    { label: "Yesterday", from: addDays(settings.today, -1), to: addDays(settings.today, -1) },
    { label: "Last 7 days", from: addDays(settings.today, -6), to: settings.today },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Bills" description="Every order and bill. Tap one to open it, reprint it or see how it was paid." />

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          {quick.map((x) => (
            <Button key={x.label} size="sm" variant={from === x.from && to === x.to ? "primary" : "outline"} onClick={() => (setFrom(x.from), setTo(x.to))}>
              {x.label}
            </Button>
          ))}
          <label className="text-sm text-slate-600">
            From <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
          </label>
          <label className="text-sm text-slate-600">
            To <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
          </label>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs<Status>
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "all", label: "All" },
              { value: "running", label: "Running" },
              { value: "settled", label: "Paid" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no., order no., table, name or phone" className="pl-9" aria-label="Search bills" />
          </div>
        </div>
      </Card>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ReceiptText className="h-6 w-6" />} title="No bills found" description="Try another date or clear the search." />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm text-slate-600">
            <span>{rows.length} order(s)</span>
            {paid.length > 0 && (
              <span>
                Paid: <b className="text-slate-900">{formatCurrency(paid.reduce((s, r) => s + r.total, 0))}</b> from {paid.length} bill(s)
              </span>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <Link href={`/orders/${r.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-slate-900">{r.billNumber ? `Bill ${r.billNumber}` : `Order #${r.number}`}</b>
                      <StatusBadge status={r.status} />
                      <Badge variant={r.type}>{r.type === "dine_in" && r.table ? `Table ${r.table.name}` : label(r.type)}</Badge>
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {formatDate(r.createdAt)} {formatTime(r.settledAt ?? r.createdAt, settings.timezone)} · #{r.number} · {r.itemCount} item(s)
                      {r.customerName && ` · ${r.customerName}`}
                      {r.customerPhone && ` · ${r.customerPhone}`}
                      {r.createdByName && ` · by ${r.createdByName}`}
                    </span>
                    {r.cancelReason && <span className="block text-sm text-red-700">Cancelled: {r.cancelReason}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <b className={r.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}>{formatCurrency(r.total)}</b>
                    {r.methods.length > 0 && <span className="block text-xs text-slate-500">{r.methods.map(label).join(" + ")}</span>}
                  </span>
                </Link>
                {r.billNumber && (
                  <a href={`/print/bill/${r.id}?auto=1`} target="_blank" rel="noopener noreferrer" aria-label="Print bill" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Printer className="h-5 w-5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
