"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, PackageCheck, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, Select, StatCard, Tabs, Textarea, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { api, whatsappLink } from "@/lib/client";
import { parseVariants } from "@/lib/menu";
import { linesTotal, parsePurchaseLines, purchaseMessage } from "@/lib/purchases";
import { cn, formatCurrency, formatDate, formatDateTime, label } from "@/lib/utils";
import type { CategoryDTO, SettingsDTO } from "@/lib/types";

interface StockOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  quantity: number;
  lowAt: number | null;
  active: boolean;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  balance: number;
  active: boolean;
  _count?: { purchases: number };
}

interface Purchase {
  id: string;
  number: number;
  supplierId: string | null;
  supplierName: string;
  status: string;
  invoiceNo: string | null;
  orderedOn: string;
  receivedOn: string | null;
  lines: string;
  total: number;
  notes: string | null;
  createdByName: string;
}

const qty = (n: number) => String(Math.round(n * 1000) / 1000);
const STATUS_VARIANT: Record<string, string> = { ordered: "warning", received: "success", cancelled: "cancelled" };
const STATUS_LABEL: Record<string, string> = { ordered: "Ordered", received: "Received", cancelled: "Cancelled" };

function useRestaurantName() {
  const { settings } = useApp();
  const [name, setName] = useState(settings.restaurantName);
  useEffect(() => {
    api<{ settings: SettingsDTO }>("/api/settings").then((r) => setName(r.settings.restaurantName), () => null);
  }, []);
  return name;
}

function NewPurchaseDialog({ stock, suppliers, onClose, onSaved }: { stock: StockOption[]; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const low = stock.filter((s) => s.active && s.lowAt !== null && s.quantity <= s.lowAt);
  const [supplierId, setSupplierId] = useState(suppliers.find((s) => s.active)?.id ?? "");
  const [lines, setLines] = useState<Array<{ stockItemId: string; quantity: string; rate: string }>>(
    low.length ? low.map((s) => ({ stockItemId: s.id, quantity: "", rate: s.costPerUnit ? String(s.costPerUnit) : "" })) : [{ stockItemId: "", quantity: "", rate: "" }]
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const total = linesTotal(lines.map((l) => ({ quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0 })));

  async function save() {
    setSaving(true);
    try {
      await api("/api/purchases", {
        body: {
          supplierId: supplierId || null,
          lines: lines.filter((l) => l.stockItemId && Number(l.quantity) > 0).map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity), rate: Number(l.rate) || 0 })),
          notes: notes || null,
        },
      });
      toast("Purchase order made. Send it to the supplier on WhatsApp.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New purchase order"
      description={low.length ? `${low.length} item(s) running low are filled in.` : "What to buy, and roughly at what price."}
      size="xl"
      footer={
        <>
          <span className="mr-auto text-sm text-slate-600">About {formatCurrency(total)}</span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!supplierId || !lines.some((l) => l.stockItemId && Number(l.quantity) > 0)} onClick={save}>
            Make purchase order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier" hint={suppliers.length ? undefined : "Add your suppliers in the Suppliers tab first"}>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choose…</option>
            {suppliers
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </Select>
        </Field>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const item = stock.find((s) => s.id === l.stockItemId);
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Field label={i === 0 ? "Item" : undefined} className="min-w-48 flex-1">
                  <Select value={l.stockItemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, stockItemId: e.target.value, rate: x.rate || String(stock.find((s) => s.id === e.target.value)?.costPerUnit || "") } : x)))} aria-label="Item">
                    <option value="">Choose…</option>
                    {stock
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (in stock {qty(s.quantity)} {s.unit})
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? `Quantity${item ? ` (${item.unit})` : ""}` : undefined} className="w-32">
                  <Input type="number" min={0} step="0.001" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantity" />
                </Field>
                <Field label={i === 0 ? "Rate (₹ per unit)" : undefined} className="w-36">
                  <Input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} aria-label="Rate" />
                </Field>
                <Button variant="ghost" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, { stockItemId: "", quantity: "", rate: "" }])}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </div>
        <Field label="Note for the supplier" optional>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. deliver before 10 am" maxLength={300} />
        </Field>
      </div>
    </Modal>
  );
}

function ReceiveDialog({ purchase, onClose, onSaved }: { purchase: Purchase; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const ordered = parsePurchaseLines(purchase.lines);
  const [lines, setLines] = useState(ordered.map((l) => ({ ...l, q: String(l.quantity), r: String(l.rate) })));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const total = linesTotal(lines.map((l) => ({ quantity: Number(l.q) || 0, rate: Number(l.r) || 0 })));

  async function save() {
    setSaving(true);
    try {
      await api(`/api/purchases/${purchase.id}/receive`, {
        body: { invoiceNo: invoiceNo || null, lines: lines.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.q) || 0, rate: Number(l.r) || 0 })), paidAmount: Number(paid) || 0, paidMethod: method },
      });
      toast(`Received into stock: ${formatCurrency(total)}`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive purchase #${purchase.number}`}
      description={`From ${purchase.supplierName}. Change the quantity or rate to what is on their bill; 0 = did not come.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={saving} onClick={save}>
            <PackageCheck className="h-4 w-4" /> Add to stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Item</th>
              <th className="py-1">Received</th>
              <th className="py-1">Rate (₹)</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.stockItemId} className="border-t border-slate-100">
                <td className="py-2 font-semibold">{l.name}</td>
                <td className="py-2">
                  <span className="flex items-center gap-1">
                    <Input type="number" min={0} step="0.001" value={l.q} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} className="h-9 w-24" aria-label={`${l.name} received`} />
                    {l.unit}
                  </span>
                </td>
                <td className="py-2">
                  <Input type="number" min={0} step="0.01" value={l.r} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)))} className="h-9 w-24" aria-label={`${l.name} rate`} />
                </td>
                <td className="py-2 text-right">{formatCurrency((Number(l.q) || 0) * (Number(l.r) || 0))}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 font-bold">
              <td className="py-2" colSpan={3}>
                Bill total
              </td>
              <td className="py-2 text-right">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier's bill no." optional>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Paid now" optional hint="The rest is added to what you owe them">
            <Input type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Paid by">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["cash", "upi", "card", "bank"].map((m) => (
                <option key={m} value={m}>{m === "cash" ? "Cash (from the till)" : label(m)}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function PurchasesTab() {
  const { toast, confirm } = useApp();
  const restaurantName = useRestaurantName();
  const [filter, setFilter] = useState<"ordered" | "received" | "all">("ordered");
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [stock, setStock] = useState<StockOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Purchase | null>(null);

  const load = useCallback(() => {
    Promise.all([api<{ purchases: Purchase[] }>("/api/purchases"), api<{ items: StockOption[] }>("/api/stock"), api<{ suppliers: Supplier[] }>("/api/suppliers")]).then(
      ([p, s, sup]) => {
        setPurchases(p.purchases);
        setStock(s.items);
        setSuppliers(sup.suppliers);
      },
      (e) => toast(e.message, "error")
    );
  }, [toast]);
  useEffect(() => load(), [load]);

  if (!purchases) return <Loading />;
  const shown = filter === "all" ? purchases : purchases.filter((p) => p.status === filter);
  const phoneOf = (p: Purchase) => suppliers.find((s) => s.id === p.supplierId)?.phone ?? null;

  async function cancel(p: Purchase) {
    const ok = await confirm({ title: `Cancel purchase order #${p.number}?`, confirmText: "Cancel order", danger: true });
    if (!ok) return;
    try {
      await api(`/api/purchases/${p.id}`, { method: "PATCH", body: { status: "cancelled" } });
      toast("Purchase order cancelled");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "ordered", label: "Waiting to arrive", count: purchases.filter((p) => p.status === "ordered").length },
            { value: "received", label: "Received" },
            { value: "all", label: "All" },
          ]}
        />
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> New purchase order
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Truck className="h-6 w-6" />} title={filter === "ordered" ? "Nothing on order" : "No purchases yet"} description="Make a purchase order, send it to the supplier on WhatsApp, and add it to stock when it arrives." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {shown.map((p) => {
              const lines = parsePurchaseLines(p.lines);
              const phone = phoneOf(p);
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      #{p.number} · {p.supplierName}
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                      <span className="text-sm font-normal text-slate-500">
                        ordered {formatDate(p.orderedOn)}
                        {p.receivedOn && ` · received ${formatDate(p.receivedOn)}`}
                        {p.invoiceNo && ` · bill ${p.invoiceNo}`}
                      </span>
                    </p>
                    <p className="truncate text-sm text-slate-600">{lines.map((l) => `${l.name} ${qty(l.quantity)} ${l.unit}`).join(", ")}</p>
                  </div>
                  <p className="shrink-0 font-bold text-slate-900">{formatCurrency(p.total)}</p>
                  {p.status === "ordered" && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a href={whatsappLink(phone, purchaseMessage({ number: p.number, lines, notes: p.notes }, restaurantName))} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-emerald-700">
                          <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                        </Button>
                      </a>
                      <Button size="sm" variant="success" onClick={() => setReceiving(p)}>
                        <PackageCheck className="h-4 w-4" /> Received
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancel(p)} aria-label={`Cancel purchase order ${p.number}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {creating && (
        <NewPurchaseDialog
          stock={stock}
          suppliers={suppliers}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {receiving && (
        <ReceiveDialog
          purchase={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const EMPTY_SUPPLIER = { name: "", phone: "", gstin: "", address: "", notes: "" };

function SupplierDialog({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { toast, settings } = useApp();
  const [f, setF] = useState(supplier ? { name: supplier.name, phone: supplier.phone ?? "", gstin: supplier.gstin ?? "", address: supplier.address ?? "", notes: supplier.notes ?? "" } : EMPTY_SUPPLIER);
  const [detail, setDetail] = useState<{ supplier: Supplier; purchases: Purchase[]; payments: Array<{ id: string; amount: number; method: string; notes: string | null; createdAt: string; createdByName: string }> } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    if (supplier) api<NonNullable<typeof detail>>(`/api/suppliers/${supplier.id}`).then(setDetail, () => null);
  }, [supplier]);
  useEffect(() => load(), [load]);

  async function save() {
    setSaving("save");
    try {
      if (supplier) await api(`/api/suppliers/${supplier.id}`, { method: "PUT", body: f });
      else await api("/api/suppliers", { body: f });
      toast("Supplier saved");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
      setSaving(null);
    }
  }

  async function pay() {
    if (!supplier) return;
    setSaving("pay");
    try {
      await api(`/api/suppliers/${supplier.id}/pay`, { body: { amount: Number(amount), method, note: note || null } });
      toast(`${formatCurrency(Number(amount))} paid to ${supplier.name}`);
      setAmount("");
      setNote("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  }

  const owed = detail?.supplier.balance ?? supplier?.balance ?? 0;
  const text = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Modal
      open
      onClose={() => (detail && supplier ? onSaved() : onClose())}
      title={supplier ? supplier.name : "Add a supplier"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => (detail && supplier ? onSaved() : onClose())}>Close</Button>
          <Button loading={saving === "save"} disabled={!f.name.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input {...text("name")} maxLength={80} autoFocus={!supplier} />
          </Field>
          <Field label="Phone / WhatsApp" optional>
            <Input type="tel" {...text("phone")} maxLength={20} />
          </Field>
          <Field label="GSTIN" optional>
            <Input {...text("gstin")} maxLength={20} />
          </Field>
          <Field label="Address" optional>
            <Input {...text("address")} maxLength={300} />
          </Field>
          <Field label="Notes" optional className="sm:col-span-2">
            <Textarea rows={2} {...text("notes")} maxLength={300} placeholder="What they supply, credit days…" />
          </Field>
        </div>
        {supplier && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="flex items-center justify-between font-semibold">
              Account
              <span className={cn("text-lg", owed > 0 ? "text-red-700" : "text-emerald-700")}>{owed > 0 ? `You owe ${formatCurrency(owed)}` : owed < 0 ? `Paid ${formatCurrency(-owed)} in advance` : "Nothing owed"}</span>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Pay them" className="w-36">
                <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={owed > 0 ? String(owed) : "0"} />
              </Field>
              <Field label="By" className="w-44">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {["cash", "upi", "card", "bank"].map((m) => (
                    <option key={m} value={m}>{m === "cash" ? "Cash (from the till)" : label(m)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Note" optional className="min-w-36 flex-1">
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button variant="outline" disabled={!(Number(amount) > 0)} loading={saving === "pay"} onClick={pay}>
                Save payment
              </Button>
            </div>
            {detail && (detail.purchases.length > 0 || detail.payments.length > 0) && (
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
                {[
                  ...detail.purchases.filter((p) => p.status === "received").map((p) => ({ key: p.id, at: p.receivedOn ?? p.orderedOn, text: `Purchase #${p.number}${p.invoiceNo ? ` · bill ${p.invoiceNo}` : ""}`, amount: p.total, sign: "+" })),
                  ...detail.payments.map((x) => ({ key: x.id, at: x.createdAt, text: `Paid by ${label(x.method)}${x.notes ? ` · ${x.notes}` : ""}`, amount: x.amount, sign: "−" })),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((r) => (
                    <li key={r.key} className="flex justify-between gap-3 px-3 py-2">
                      <span>
                        {r.text}
                        <span className="block text-xs text-slate-500">{r.at.length > 10 ? formatDateTime(r.at, settings.timezone) : formatDate(r.at)}</span>
                      </span>
                      <b className={r.sign === "+" ? "text-red-700" : "text-emerald-700"}>
                        {r.sign}
                        {formatCurrency(r.amount)}
                      </b>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function SuppliersTab() {
  const { toast, confirm } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [open, setOpen] = useState<Supplier | null | "new">(null);

  const load = useCallback(() => {
    api<{ suppliers: Supplier[] }>("/api/suppliers").then((r) => setSuppliers(r.suppliers), (e) => toast(e.message, "error"));
  }, [toast]);
  useEffect(() => load(), [load]);

  if (!suppliers) return <Loading />;
  const active = suppliers.filter((s) => s.active);
  const owed = active.reduce((sum, s) => sum + Math.max(0, s.balance), 0);

  async function remove(s: Supplier) {
    const ok = await confirm({ title: `Remove ${s.name}?`, message: "Their old purchases and payments are kept.", confirmText: "Remove", danger: true });
    if (!ok) return;
    try {
      await api(`/api/suppliers/${s.id}`, { method: "DELETE" });
      toast("Supplier removed");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard title="Suppliers" value={active.length} icon={<Truck className="h-5 w-5" />} tone="sky" />
        <StatCard title="You owe suppliers" value={formatCurrency(owed)} subtitle={`${active.filter((s) => s.balance > 0).length} supplier(s)`} tone="red" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen("new")}>
          <Plus className="h-5 w-5" /> Add supplier
        </Button>
      </div>
      {active.length === 0 ? (
        <EmptyState icon={<Truck className="h-6 w-6" />} title="No suppliers yet" description="Add the people you buy vegetables, meat, dairy and packaging from. Then make purchase orders and track what you owe them." />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {active.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <button onClick={() => setOpen(s)} className="min-w-0 flex-1 text-left">
                  <span className="block font-semibold text-slate-900">{s.name}</span>
                  <span className="block truncate text-sm text-slate-500">
                    {[s.phone, s.notes, s._count ? `${s._count.purchases} purchase(s)` : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {s.balance > 0 ? <Badge variant="danger">You owe {formatCurrency(s.balance)}</Badge> : <Badge variant="success">Settled</Badge>}
                <Button size="sm" variant="outline" onClick={() => setOpen(s)} aria-label={`Open ${s.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {open && (
        <SupplierDialog
          supplier={open === "new" ? null : open}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface RecipeLine {
  menuItemId: string;
  variant: string | null;
  stockItemId: string;
  quantity: number;
}

/** What each dish costs to make from its recipe, against its price. */
export function CostingTab() {
  const [menu, setMenu] = useState<CategoryDTO[] | null>(null);
  const [stock, setStock] = useState<StockOption[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  useEffect(() => {
    Promise.all([api<{ categories: CategoryDTO[] }>("/api/menu"), api<{ items: StockOption[] }>("/api/stock"), api<{ lines: RecipeLine[] }>("/api/recipes"), api<{ settings: SettingsDTO }>("/api/settings")]).then(([m, s, r, st]) => {
      setMenu(m.categories);
      setStock(s.items);
      setLines(r.lines);
      setSettings(st.settings);
    });
  }, []);

  const rows = useMemo(() => {
    if (!menu || !settings) return [];
    const cost = new Map(stock.map((s) => [s.id, s.costPerUnit]));
    return menu.flatMap((c) =>
      c.items.flatMap((d) => {
        const mine = lines.filter((l) => l.menuItemId === d.id);
        if (mine.length === 0) return [];
        const portions = parseVariants(d.variants);
        const list = portions.length ? portions.map((p) => ({ variant: p.name, price: p.price })) : [{ variant: null as string | null, price: d.price }];
        return list.map((p) => {
          const used = mine.filter((l) => l.variant === null || l.variant === p.variant);
          const dishCost = used.reduce((s, l) => s + l.quantity * (cost.get(l.stockItemId) ?? 0), 0);
          const rate = d.taxRate ?? settings.defaultTaxRate;
          // Compare with the price before tax: that is what the restaurant keeps.
          const net = settings.pricesIncludeTax && settings.taxMode !== "none" ? p.price / (1 + rate / 100) : p.price;
          const missing = used.some((l) => !(cost.get(l.stockItemId) ?? 0));
          return { id: `${d.id}:${p.variant}`, name: d.name, variant: p.variant, foodType: d.foodType, category: c.name, price: p.price, cost: dishCost, percent: net > 0 ? (dishCost / net) * 100 : 0, margin: net - dishCost, missing };
        });
      })
    );
  }, [menu, stock, lines, settings]);

  if (!menu || !settings) return <Loading />;
  const sorted = [...rows].sort((a, b) => b.percent - a.percent);
  const avg = rows.length ? rows.reduce((s, r) => s + r.percent, 0) / rows.length : 0;

  return (
    <div className="space-y-4">
      <Tip>
        Food cost = what the ingredients in the recipe cost (at your last purchase price) as a share of the dish&apos;s price before tax. Most restaurants aim for 25–35%. Dishes above 40%
        may need a new price or recipe.
      </Tip>
      {rows.length === 0 ? (
        <EmptyState title="No recipes yet" description="Add recipes in the Recipes tab and purchase prices in Stock, and each dish's cost and margin appear here." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard title="Dishes with a recipe" value={rows.length} tone="sky" />
            <StatCard title="Average food cost" value={`${avg.toFixed(0)}%`} tone={avg > 35 ? "red" : "green"} />
            <StatCard title="Above 40%" value={rows.filter((r) => r.percent > 40).length} tone="amber" />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-2">Dish</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Ingredient cost</th>
                    <th className="px-4 py-2 text-right">Food cost</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          <FoodMark type={r.foodType} /> {r.name}
                          {r.variant && <span className="font-normal text-slate-500">({r.variant})</span>}
                        </span>
                        <span className="text-xs text-slate-500">
                          {r.category}
                          {r.missing && <b className="text-amber-700"> · some ingredients have no purchase price</b>}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(r.price)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(r.cost)}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge variant={r.percent > 40 ? "danger" : r.percent > 30 ? "warning" : "success"}>{r.percent.toFixed(0)}%</Badge>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
