"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Gift, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api, whatsappLink } from "@/lib/client";
import { formatCurrency, formatDate, label } from "@/lib/utils";

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  points: number;
  visits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  createdAt: string;
}

interface CustomerOrder {
  id: string;
  number: number;
  billNumber: string | null;
  type: string;
  status: string;
  total: number;
  settledAt: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
  table: { name: string } | null;
}

interface Stats {
  count: number;
  repeat: number;
  points: number;
  spent: number;
}

const EXPORT_URL = "/api/customers/export";
const EMPTY = { phone: "", name: "", address: "", email: "", birthday: "", notes: "" };

function CustomerForm({ value, onChange }: { value: typeof EMPTY; onChange: (v: typeof EMPTY) => void }) {
  const text = (k: keyof typeof EMPTY) => ({ value: value[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value }) });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Phone">
        <Input type="tel" {...text("phone")} required />
      </Field>
      <Field label="Name" optional>
        <Input {...text("name")} />
      </Field>
      <Field label="Address" optional className="sm:col-span-2">
        <Input {...text("address")} />
      </Field>
      <Field label="Email" optional>
        <Input type="email" {...text("email")} />
      </Field>
      <Field label="Birthday" optional hint="For birthday offers">
        <Input type="date" {...text("birthday")} />
      </Field>
      <Field label="Notes" optional hint="Likes, allergies, regular order…" className="sm:col-span-2">
        <Textarea rows={2} {...text("notes")} />
      </Field>
    </div>
  );
}

function CustomerDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm, settings } = useApp();
  const [data, setData] = useState<{ customer: Customer; orders: CustomerOrder[] } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ customer: Customer; orders: CustomerOrder[] }>(`/api/customers/${id}`).then((r) => {
      setData(r);
      const c = r.customer;
      setForm({ phone: c.phone, name: c.name ?? "", address: c.address ?? "", email: c.email ?? "", birthday: c.birthday ?? "", notes: c.notes ?? "" });
    });
  }, [id]);
  useEffect(() => load(), [load]);

  async function save(body: Record<string, unknown>, message: string) {
    setSaving(true);
    try {
      await api(`/api/customers/${id}`, { method: "PATCH", body });
      toast(message);
      setPoints("");
      setReason("");
      load();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Remove this customer?", message: "Their bills stay in Bills. Their loyalty points are lost.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      toast("Customer removed");
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const c = data?.customer;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={c ? c.name || c.phone : "Customer"}
      description={c ? `${c.visits} visit${c.visits === 1 ? "" : "s"} · ${formatCurrency(c.totalSpent)} spent${c.lastVisitAt ? ` · last visit ${formatDate(c.lastVisitAt)}` : ""}` : undefined}
      footer={
        c && (
          <>
            <Button variant="ghost" className="mr-auto text-red-600" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
            <a href={whatsappLink(c.phone, `Hello${c.name ? ` ${c.name}` : ""}, `)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">WhatsApp</Button>
            </a>
            <Button loading={saving} onClick={() => save(form, "Customer saved")}>Save</Button>
          </>
        )
      }
    >
      {!c ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <CustomerForm value={form} onChange={setForm} />
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Gift className="h-4 w-4 text-emerald-600" /> Loyalty points: {c.points}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Add or take away" hint="e.g. 50 or -50" className="w-40">
                <Input type="number" step="1" value={points} onChange={(e) => setPoints(e.target.value)} />
              </Field>
              <Field label="Reason" className="min-w-48 flex-1">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. sorry for the late food" />
              </Field>
              <Button variant="outline" disabled={!Number(points) || !reason.trim()} loading={saving} onClick={() => save({ pointsChange: Math.trunc(Number(points)), pointsReason: reason.trim() }, "Points changed")}>
                Change points
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-900">Recent bills</p>
            {data.orders.length === 0 ? (
              <p className="text-sm text-slate-500">No paid bills yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <span>
                        <b>{o.billNumber ? `Bill ${o.billNumber}` : `Order #${o.number}`}</b>
                        <span className="text-slate-500"> · {o.table ? `Table ${o.table.name}` : label(o.type)}{o.settledAt && ` · ${formatDate(o.settledAt)}`}</span>
                        {o.status === "cancelled" && <Badge variant="cancelled" className="ml-2">Cancelled</Badge>}
                      </span>
                      <span className="text-right">
                        <b>{formatCurrency(o.total)}</b>
                        {(o.pointsEarned > 0 || o.pointsRedeemed > 0) && (
                          <span className="block text-xs text-emerald-700">
                            {o.pointsEarned > 0 && `+${o.pointsEarned}`} {o.pointsRedeemed > 0 && `−${o.pointsRedeemed}`} pts
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-400">Customer since {formatDate(c.createdAt)} · times in {settings.timezone}</p>
        </div>
      )}
    </Modal>
  );
}

export default function CustomersPage() {
  const { isAdmin, toast } = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [data, setData] = useState<{ customers: Customer[]; stats: Stats } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(() => {
    const p = new URLSearchParams({ sort });
    if (q.trim()) p.set("q", q.trim());
    api<{ customers: Customer[]; stats: Stats }>(`/api/customers?${p}`).then(setData, (e) => toast(e.message, "error"));
  }, [q, sort, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q, isAdmin]);

  if (!isAdmin) return <Tip tone="warning">Only the owner / manager can see the customer list.</Tip>;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/customers", { body: form });
      toast("Customer added");
      setAdding(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Saved automatically from the phone number on paid bills. See who comes back, their spend and loyalty points."
        actions={
          <>
            <a href={EXPORT_URL} download>
              <Button variant="outline">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </a>
            <Button onClick={() => setAdding(true)}>
              <UserPlus className="h-4 w-4" /> Add customer
            </Button>
          </>
        }
      />

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Customers" value={data.stats.count} icon={<Users className="h-5 w-5" />} tone="primary" />
          <StatCard title="Came back" value={data.stats.repeat} subtitle="2 or more visits" tone="green" />
          <StatCard title="Total spent" value={formatCurrency(data.stats.spent)} tone="sky" />
          <StatCard title="Points not used yet" value={Math.round(data.stats.points)} icon={<Gift className="h-5 w-5" />} tone="amber" />
        </div>
      )}

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" className="pl-9" aria-label="Search customers" />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="sm:w-56" aria-label="Sort">
          <option value="recent">Last visit first</option>
          <option value="spent">Most spent first</option>
          <option value="visits">Most visits first</option>
          <option value="points">Most points first</option>
        </Select>
      </Card>

      {!data ? (
        <Loading />
      ) : data.customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={q ? "No customer matches" : "No customers yet"}
          description="Add the customer's phone number on an order. When the bill is paid, they appear here."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.customers.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpen(c.id)} className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">{c.name || "No name"}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {c.phone}
                      {c.lastVisitAt && ` · last visit ${formatDate(c.lastVisitAt)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-sm text-slate-600">
                    <span>{c.visits} visit{c.visits === 1 ? "" : "s"}</span>
                    <b className="text-slate-900">{formatCurrency(c.totalSpent)}</b>
                    {c.points > 0 && <Badge variant="success">{c.points} pts</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {open && <CustomerDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a customer" size="lg">
        <form onSubmit={add} className="space-y-4">
          <CustomerForm value={form} onChange={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit">Add customer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
