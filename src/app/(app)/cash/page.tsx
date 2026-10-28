"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, Calculator, Lock, MessageCircle, Plus, Printer, ReceiptText, Trash2, Wallet } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, EmptyState, Field, Input, Loading, Modal, PageHeader, Row, Select, StatCard, Tabs, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { addDays } from "@/lib/dates";
import { cn, formatCurrency, formatDate, formatDateTime, formatTime, label } from "@/lib/utils";

type Tab = "expenses" | "close" | "history";

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  method: string;
  paidTo: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
}

interface Summary {
  date: string;
  bills: number;
  guests: number;
  sales: number;
  discount: number;
  complimentary: { count: number; value: number };
  tax: number;
  cancelled: number;
  payments: Array<{ method: string; amount: number; count: number }>;
  expenses: Expense[];
  expensesTotal: number;
  expensesByCategory: Array<{ category: string; amount: number }>;
  cashSales: number;
  cashExpenses: number;
  cashReceived: number;
  received: Array<{ method: string; amount: number; count: number }>;
  openingCash: number;
  expectedCash: number;
  runningOrders: number;
  close: {
    openingCash: number;
    countedCash: number;
    difference: number;
    cashLeft: number;
    notes: string | null;
    closedByName: string;
    closedAt: string;
  } | null;
  previousClose: { date: string; cashLeft: number } | null;
}

const CATEGORIES = [
  "Vegetables & fruit",
  "Groceries",
  "Meat & fish",
  "Dairy",
  "Gas / fuel",
  "Staff salary / advance",
  "Rent",
  "Electricity & water",
  "Repairs",
  "Cleaning",
  "Packaging",
  "Marketing",
  "Supplier payment",
  "Other",
];
const NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/** The day in a few lines, for the owner's WhatsApp. */
function daySummaryText(s: Summary, restaurantName: string, date: string, expected: number) {
  const lines = [
    `${restaurantName} — ${formatDate(date)}`,
    `Sales ${formatCurrency(s.sales)} (${s.bills} bills${s.guests ? `, ${s.guests} guests` : ""})`,
    s.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount)}`).join(" · "),
    s.cashReceived > 0 ? `Received on customer accounts (cash) ${formatCurrency(s.cashReceived)}` : "",
    `Expenses ${formatCurrency(s.expensesTotal)}${s.cashExpenses ? ` (${formatCurrency(s.cashExpenses)} cash)` : ""}`,
    `Discounts ${formatCurrency(s.discount)}${s.complimentary.count ? ` · ${s.complimentary.count} complimentary (${formatCurrency(s.complimentary.value)})` : ""}${s.cancelled ? ` · ${s.cancelled} cancelled` : ""}`,
    s.close
      ? `Cash: should be ${formatCurrency(expected)}, counted ${formatCurrency(s.close.countedCash)}${s.close.difference ? ` (${s.close.difference < 0 ? "short" : "extra"} ${formatCurrency(Math.abs(s.close.difference))})` : " — matches"}`
      : `Cash that should be in the drawer: ${formatCurrency(expected)} (day not closed yet)`,
  ];
  return lines.filter(Boolean).join("\n");
}

function ExpenseDialog({ today, onSaved, onClose }: { today: string; onSaved: () => void; onClose: () => void }) {
  const { isAdmin, toast } = useApp();
  const [form, setForm] = useState({ date: today, category: CATEGORIES[0], amount: "", method: "cash", paidTo: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/expenses", { body: { ...form, amount: Number(form.amount) } });
      toast("Expense saved");
      onSaved();
    } catch (err) {
      toast((err as Error).message, "error");
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Add an expense" description="Money paid out, e.g. to the vegetable seller or a staff advance.">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="What for" htmlFor="expense-category">
          <Input id="expense-category" list="expense-categories" value={form.category} onChange={(e) => set({ category: e.target.value })} required maxLength={60} />
          <datalist id="expense-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Amount">
          <Input type="number" min={0.01} step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} required autoFocus />
        </Field>
        <Field label="Paid by" hint={form.method === "cash" ? "Taken out of the cash drawer" : undefined}>
          <Select value={form.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="cash">Cash (from the till)</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank">Bank transfer</option>
          </Select>
        </Field>
        <Field label="Paid to" optional>
          <Input value={form.paidTo} onChange={(e) => set({ paidTo: e.target.value })} maxLength={100} placeholder="e.g. Ramesh Vegetables" />
        </Field>
        {isAdmin && (
          <Field label="Date">
            <Input type="date" value={form.date} max={today} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        )}
        <Field label="Note" optional className={isAdmin ? "" : "sm:col-span-2"}>
          <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save expense</Button>
        </div>
      </form>
    </Modal>
  );
}

function ExpensesTab() {
  const { settings, isAdmin, toast, confirm } = useApp();
  const [from, setFrom] = useState(settings.today);
  const [to, setTo] = useState(settings.today);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api<{ expenses: Expense[] }>(`/api/expenses?from=${from}&to=${to}`).then((r) => setRows(r.expenses), (e) => toast(e.message, "error"));
  }, [from, to, toast]);
  useEffect(() => load(), [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of rows ?? []) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()];
  }, [rows]);
  const total = (rows ?? []).reduce((s, e) => s + e.amount, 0);

  async function remove(e: Expense) {
    const ok = await confirm({ title: `Delete this expense?`, message: `${e.category}: ${formatCurrency(e.amount)}`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/expenses/${e.id}`, { method: "DELETE" });
      toast("Expense deleted");
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-2 p-4">
        {isAdmin ? (
          <>
            {[
              { label: "Today", from: settings.today, to: settings.today },
              { label: "Last 7 days", from: addDays(settings.today, -6), to: settings.today },
              { label: "This month", from: `${settings.today.slice(0, 7)}-01`, to: settings.today },
            ].map((x) => (
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
          </>
        ) : (
          <p className="text-sm text-slate-600">Today&apos;s expenses. The owner sees all days.</p>
        )}
        <Button className="ml-auto" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </Card>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No expenses" description="Record money you pay out, so the cash drawer adds up at the end of the day." />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm text-slate-600">
            <span>{rows.length} expense(s)</span>
            <span>
              Total: <b className="text-slate-900">{formatCurrency(total)}</b>
            </span>
          </div>
          {byDay.map(([day, list]) => (
            <div key={day}>
              <p className="bg-slate-50 px-5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                {formatDate(day)} · {formatCurrency(list.reduce((s, e) => s + e.amount, 0))}
              </p>
              <ul className="divide-y divide-slate-100">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">
                        {e.category}
                        {e.paidTo && <span className="font-normal text-slate-500"> · {e.paidTo}</span>}
                      </span>
                      <span className="block truncate text-sm text-slate-500">
                        {label(e.method)} · {formatTime(e.createdAt, settings.timezone)} · by {e.createdByName}
                        {e.notes && ` · ${e.notes}`}
                      </span>
                    </span>
                    <b className="shrink-0">{formatCurrency(e.amount)}</b>
                    {isAdmin && (
                      <button onClick={() => remove(e)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete expense">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
      {adding && (
        <ExpenseDialog
          today={settings.today}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NoteCounter({ onUse, onClose }: { onUse: (total: number) => void; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const total = NOTES.reduce((s, n) => s + n * (Number(counts[n]) || 0), 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="Count the cash"
      description="Type how many of each note and coin are in the drawer."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onUse(total)}>Use {formatCurrency(total)}</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        {NOTES.map((n) => (
          <Field key={n} label={`₹${n} ×`}>
            <Input type="number" min={0} step="1" inputMode="numeric" value={counts[n] ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [n]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <p className="mt-4 text-lg font-bold">Total: {formatCurrency(total)}</p>
    </Modal>
  );
}

function DayCloseTab({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { settings, toast } = useApp();
  const [s, setS] = useState<Summary | null>(null);
  const [opening, setOpening] = useState("");
  const [counted, setCounted] = useState("");
  const [left, setLeft] = useState("");
  const [notes, setNotes] = useState("");
  const [counting, setCounting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fill = useCallback((summary: Summary) => {
    setS(summary);
    setOpening(String(summary.close?.openingCash ?? summary.openingCash));
    setCounted(summary.close ? String(summary.close.countedCash) : "");
    setLeft(summary.close ? String(summary.close.cashLeft) : "");
    setNotes(summary.close?.notes ?? "");
  }, []);

  useEffect(() => {
    setS(null);
    api<{ summary: Summary }>(`/api/day-close?date=${date}`).then((r) => fill(r.summary), (e) => toast(e.message, "error"));
  }, [date, fill, toast]);

  if (!s) return <Loading />;
  const expected = Math.round(((Number(opening) || 0) + s.cashSales + s.cashReceived - s.cashExpenses) * 100) / 100;
  const diff = counted === "" ? null : Math.round(((Number(counted) || 0) - expected) * 100) / 100;

  async function close() {
    setSaving(true);
    try {
      const r = await api<{ summary: Summary }>("/api/day-close", {
        body: { date, openingCash: Number(opening) || 0, countedCash: Number(counted) || 0, cashLeft: left === "" ? Number(counted) || 0 : Number(left), notes: notes || null },
      });
      fill(r.summary);
      toast(s?.close ? "Day close updated" : "Day closed");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-2 p-4">
        {[
          { label: "Today", d: settings.today },
          { label: "Yesterday", d: addDays(settings.today, -1) },
        ].map((x) => (
          <Button key={x.label} size="sm" variant={date === x.d ? "primary" : "outline"} onClick={() => setDate(x.d)}>
            {x.label}
          </Button>
        ))}
        <label className="text-sm text-slate-600">
          Day <Input type="date" value={date} max={settings.today} onChange={(e) => e.target.value && setDate(e.target.value)} className="ml-1 inline-block min-h-9 w-40 py-1" />
        </label>
        <a href={whatsappLink(null, daySummaryText(s, settings.restaurantName, date, expected))} target="_blank" rel="noopener noreferrer" className="ml-auto">
          <Button variant="outline" size="sm" className="text-emerald-700">
            <MessageCircle className="h-4 w-4" /> Send on WhatsApp
          </Button>
        </a>
        <a href={`/print/day/${date}?auto=1`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4" /> Print day summary
          </Button>
        </a>
      </Card>

      {s.close ? (
        <Tip tone="success">
          <span className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" /> {formatDate(date)} was closed by {s.close.closedByName} at {formatDateTime(s.close.closedAt, settings.timezone)}.
          </span>
          You can correct the count below and save again.
        </Tip>
      ) : (
        date === settings.today &&
        s.runningOrders > 0 && <Tip tone="warning">{s.runningOrders} order(s) are still running. Take their payment first, or they count on the day they are paid.</Tip>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Sales" value={formatCurrency(s.sales)} subtitle={`${s.bills} bills${s.guests ? ` · ${s.guests} guests` : ""}`} icon={<ReceiptText className="h-5 w-5" />} tone="green" />
        <StatCard title="Cash sales" value={formatCurrency(s.cashSales)} icon={<Banknote className="h-5 w-5" />} tone="sky" />
        <StatCard title="Expenses" value={formatCurrency(s.expensesTotal)} subtitle={`${formatCurrency(s.cashExpenses)} paid in cash`} icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard title="Sales − expenses" value={formatCurrency(s.sales - s.expensesTotal)} tone="primary" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cash drawer" description="Count the cash at the end of the day and compare." />
          <CardContent className="space-y-4">
            <Field label="Cash in the drawer when the day started" hint={s.previousClose && !s.close ? `Left in the drawer on ${formatDate(s.previousClose.date)}` : undefined}>
              <Input type="number" min={0} step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </Field>
            <div className="rounded-xl bg-slate-50 px-4 py-2">
              <Row label="+ Cash sales">{formatCurrency(s.cashSales)}</Row>
              {s.cashReceived > 0 && <Row label="+ Cash received on customer accounts">{formatCurrency(s.cashReceived)}</Row>}
              <Row label="− Cash expenses">{formatCurrency(s.cashExpenses)}</Row>
              <Row label="Should be in the drawer" strong>
                {formatCurrency(expected)}
              </Row>
            </div>
            <div className="flex items-end gap-2">
              <Field label="Cash counted" className="flex-1">
                <Input type="number" min={0} step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Count the drawer" />
              </Field>
              <Button variant="outline" onClick={() => setCounting(true)}>
                <Calculator className="h-4 w-4" /> Count notes
              </Button>
            </div>
            {diff !== null && (
              <div className={cn("rounded-xl px-4 py-3 text-lg font-bold", diff === 0 ? "bg-emerald-50 text-emerald-800" : diff < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900")}>
                {diff === 0 ? "Cash matches." : diff < 0 ? `${formatCurrency(-diff)} short` : `${formatCurrency(diff)} extra`}
              </div>
            )}
            <Field label="Cash left in the drawer for tomorrow" optional hint="The rest goes to the bank or the owner. Empty = all of it stays.">
              <Input type="number" min={0} step="0.01" value={left} onChange={(e) => setLeft(e.target.value)} placeholder={counted || "0"} />
            </Field>
            <Field label="Note" optional>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. ₹200 short, cashier will check" />
            </Field>
            <Button size="lg" className="w-full" loading={saving} disabled={counted === ""} onClick={close}>
              <Lock className="h-5 w-5" /> {s.close ? "Save corrected count" : "Close the day"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payments received" />
            <CardContent>
              {s.payments.length === 0 ? (
                <p className="text-slate-500">No paid bills on this day.</p>
              ) : (
                s.payments.map((p) => (
                  <Row key={p.method} label={`${label(p.method)} (${p.count})`}>
                    {formatCurrency(p.amount)}
                  </Row>
                ))
              )}
              <Row label="Total" strong>
                {formatCurrency(s.sales)}
              </Row>
              {s.received.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="text-sm font-semibold text-slate-600">Received on customer accounts</p>
                  {s.received.map((r) => (
                    <Row key={r.method} label={`${label(r.method)} (${r.count})`}>
                      {formatCurrency(r.amount)}
                    </Row>
                  ))}
                </div>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Discounts {formatCurrency(s.discount)}
                {s.complimentary.count > 0 && ` · ${s.complimentary.count} complimentary (${formatCurrency(s.complimentary.value)})`} · Tax {formatCurrency(s.tax)}
                {s.cancelled > 0 && ` · ${s.cancelled} cancelled`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Expenses" />
            <CardContent>
              {s.expenses.length === 0 ? (
                <p className="text-slate-500">No expenses recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {s.expenses.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3 py-1.5 text-[15px]">
                      <span>
                        {e.category}
                        {e.paidTo && <span className="text-slate-500"> · {e.paidTo}</span>}
                        <Badge className="ml-2">{label(e.method)}</Badge>
                      </span>
                      <b>{formatCurrency(e.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {counting && (
        <NoteCounter
          onClose={() => setCounting(false)}
          onUse={(t) => {
            setCounted(String(t));
            setCounting(false);
          }}
        />
      )}
    </div>
  );
}

interface CloseRow {
  id: string;
  date: string;
  sales: number;
  bills: number;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  closedByName: string;
}

function HistoryTab({ onOpen }: { onOpen: (date: string) => void }) {
  const [rows, setRows] = useState<CloseRow[] | null>(null);
  useEffect(() => {
    api<{ closes: CloseRow[] }>("/api/day-close/history").then((r) => setRows(r.closes), () => setRows([]));
  }, []);
  if (!rows) return <Loading />;
  if (rows.length === 0) return <EmptyState icon={<Lock className="h-6 w-6" />} title="No days closed yet" description="Close the day on the Day close tab at the end of each day." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[15px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
            <th className="px-5 py-2 font-semibold">Day</th>
            <th className="py-2 text-right font-semibold">Sales</th>
            <th className="py-2 text-right font-semibold">Cash sales</th>
            <th className="py-2 text-right font-semibold">Cash expenses</th>
            <th className="py-2 text-right font-semibold">Expected</th>
            <th className="py-2 text-right font-semibold">Counted</th>
            <th className="px-5 py-2 text-right font-semibold">Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.date)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
              <td className="px-5 py-2">
                <b>{formatDate(r.date)}</b>
                <span className="block text-xs text-slate-500">{r.bills} bills · {r.closedByName}</span>
              </td>
              <td className="py-2 text-right">{formatCurrency(r.sales)}</td>
              <td className="py-2 text-right">{formatCurrency(r.cashSales)}</td>
              <td className="py-2 text-right">{formatCurrency(r.cashExpenses)}</td>
              <td className="py-2 text-right">{formatCurrency(r.expectedCash)}</td>
              <td className="py-2 text-right">{formatCurrency(r.countedCash)}</td>
              <td className={cn("px-5 py-2 text-right font-semibold", r.difference === 0 ? "text-emerald-700" : r.difference < 0 ? "text-red-700" : "text-amber-700")}>
                {r.difference === 0 ? "Matches" : `${r.difference < 0 ? "−" : "+"}${formatCurrency(Math.abs(r.difference))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CashView() {
  const { isAdmin, settings } = useApp();
  const sp = useSearchParams();
  const requested = sp.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(isAdmin && requested && ["expenses", "close", "history"].includes(requested) ? requested : "expenses");
  const [date, setDate] = useState(settings.today);
  const change = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/cash?tab=${t}`);
  };
  return (
    <div className="space-y-6">
      <PageHeader title={isAdmin ? "Cash & day close" : "Expenses"} description={isAdmin ? "Expenses paid out, and the cash drawer counted at the end of each day." : "Record money paid out of the cash drawer."} />
      {isAdmin && (
        <Tabs<Tab>
          value={tab}
          onChange={change}
          tabs={[
            { value: "expenses", label: "Expenses" },
            { value: "close", label: "Day close" },
            { value: "history", label: "Past days" },
          ]}
        />
      )}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "close" && isAdmin && <DayCloseTab date={date} setDate={setDate} />}
      {tab === "history" && isAdmin && (
        <HistoryTab
          onOpen={(d) => {
            setDate(d);
            change("close");
          }}
        />
      )}
    </div>
  );
}

export default function CashPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CashView />
    </Suspense>
  );
}
