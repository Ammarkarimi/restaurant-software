"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Banknote, CreditCard, Plus, QrCode, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, Tip } from "@/components/ui";
import { FoodMark } from "@/components/food-mark";
import { round2 } from "@/lib/billing";
import { parseVariants } from "@/lib/menu";
import { cn, formatCurrency, label } from "@/lib/utils";
import type { MenuItemDTO, TableDTO } from "@/lib/types";

export function PortionDialog({ item, onPick, onClose }: { item: MenuItemDTO; onPick: (variant: string, price: number) => void; onClose: () => void }) {
  const variants = parseVariants(item.variants);
  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><FoodMark type={item.foodType} /> {item.name}</span>} description="Choose a portion" size="sm">
      <div className="grid gap-2">
        {variants.map((v) => (
          <Button key={v.name} variant="outline" size="lg" className="justify-between" onClick={() => onPick(v.name, v.price)}>
            <span>{v.name}</span>
            <span>{formatCurrency(v.price)}</span>
          </Button>
        ))}
      </div>
    </Modal>
  );
}

export function OpenItemDialog({ onAdd, onClose }: { onAdd: (name: string, price: number, quantity: number) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const valid = name.trim() && Number(price) >= 0 && price !== "" && Number(quantity) >= 1;
  return (
    <Modal
      open
      onClose={onClose}
      title="Add an item that is not on the menu"
      description="For example: extra cheese, a special dish of the day, or packing charge."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onAdd(name.trim(), Number(price), Math.floor(Number(quantity)))}>Add item</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Item name" className="sm:col-span-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Price" className="sm:col-span-2">
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Quantity">
          <Input type="number" min={1} step="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function NoteDialog({ initial, title, onSave, onClose }: { initial: string; title: string; onSave: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState(initial);
  const quick = ["Less spicy", "Extra spicy", "No onion", "No garlic", "Jain", "Pack separately"];
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description="The kitchen sees this on the ticket."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(note.trim())}>Save note</Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setNote((n) => (n ? `${n}, ${q}` : q))}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:border-primary-300 hover:bg-primary-50"
          >
            {q}
          </button>
        ))}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} autoFocus />
    </Modal>
  );
}

export interface CustomerForm {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  guests: string;
  notes: string;
}

export function CustomerDialog({ initial, isDelivery, onSave, onClose }: { initial: CustomerForm; isDelivery: boolean; onSave: (f: CustomerForm) => Promise<void> | void; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<CustomerForm>) => setForm((f) => ({ ...f, ...p }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Customer & order details"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(form);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" optional>
          <Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} autoFocus />
        </Field>
        <Field label="Phone" optional>
          <Input type="tel" value={form.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} />
        </Field>
        {isDelivery && (
          <Field label="Delivery address" className="sm:col-span-2">
            <Textarea rows={2} value={form.customerAddress} onChange={(e) => set({ customerAddress: e.target.value })} />
          </Field>
        )}
        <Field label="Number of guests" optional>
          <Input type="number" min={0} inputMode="numeric" value={form.guests} onChange={(e) => set({ guests: e.target.value })} />
        </Field>
        <Field label="Order note" optional hint="For the whole order, e.g. birthday, VIP" className="sm:col-span-2">
          <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function DiscountDialog({
  initial,
  itemsTotal,
  onSave,
  onClose,
}: {
  initial: { type: string; value: number; reason: string };
  itemsTotal: number;
  onSave: (d: { type: string; value: number; reason: string }) => Promise<void> | void;
  onClose: () => void;
}) {
  const [type, setType] = useState(initial.type);
  const [value, setValue] = useState(initial.value ? String(initial.value) : "");
  const [reason, setReason] = useState(initial.reason);
  const [saving, setSaving] = useState(false);
  const n = Number(value) || 0;
  const amount = type === "percent" ? round2((itemsTotal * Math.min(n, 100)) / 100) : Math.min(n, itemsTotal);
  const invalid = n < 0 || (type === "percent" && n > 100);

  async function save(v: number) {
    setSaving(true);
    try {
      await onSave({ type, value: v, reason: reason.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Discount"
      description={`On items worth ${formatCurrency(itemsTotal)}`}
      size="sm"
      footer={
        <>
          {initial.value > 0 && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => save(0)}>
              Remove discount
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={invalid} onClick={() => save(n)}>Apply</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["percent", "amount"] as const).map((t) => (
            <Button key={t} variant={type === t ? "primary" : "outline"} onClick={() => setType(t)}>
              {t === "percent" ? "Percent (%)" : "Fixed amount"}
            </Button>
          ))}
        </div>
        {type === "percent" && (
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 25].map((p) => (
              <Button key={p} size="sm" variant={n === p ? "secondary" : "outline"} onClick={() => setValue(String(p))}>
                {p}%
              </Button>
            ))}
          </div>
        )}
        <Field label={type === "percent" ? "Discount %" : "Discount amount"} hint={n > 0 && !invalid ? `Takes ${formatCurrency(amount)} off the bill` : undefined}>
          <Input type="number" min={0} max={type === "percent" ? 100 : undefined} step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason" optional hint="Saved in the activity history, e.g. regular customer, food was late">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function MoveTableDialog({ tables, current, onMove, onClose }: { tables: TableDTO[]; current: string | null; onMove: (tableId: string) => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const free = tables.filter((t) => t.id !== current);
  return (
    <Modal open onClose={onClose} title="Move to another table" description="Only free tables are shown." size="md">
      {free.length === 0 ? (
        <p className="text-slate-500">There are no free tables right now.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {free.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="lg"
              loading={busy === t.id}
              disabled={!!busy}
              className="flex-col gap-0"
              onClick={async () => {
                setBusy(t.id);
                try {
                  await onMove(t.id);
                } finally {
                  setBusy(null);
                }
              }}
            >
              <span>{t.name}</span>
              <span className="text-xs font-normal text-slate-500">{t.area}</span>
            </Button>
          ))}
        </div>
      )}
    </Modal>
  );
}

interface PayRow {
  method: string;
  amount: string;
  reference: string;
}

const METHOD_ICONS: Record<string, typeof Banknote> = { cash: Banknote, upi: QrCode, card: CreditCard };

export function PaymentDialog({
  total,
  upiId,
  payeeName,
  billLabel,
  currency,
  onPay,
  onClose,
}: {
  total: number;
  upiId: string | null;
  payeeName: string;
  billLabel: string;
  currency: string;
  onPay: (payments: Array<{ method: string; amount: number; reference: string | null }>) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PayRow[]>([{ method: "cash", amount: String(total), reference: "" }]);
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const paying = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const left = round2(total - paying);
  const cashRow = rows.find((r) => r.method === "cash");
  const cashDue = Number(cashRow?.amount) || 0;
  const change = cashRow && received ? round2(Number(received) - cashDue) : null;
  const upiAmount = round2(rows.filter((r) => r.method === "upi").reduce((s, r) => s + (Number(r.amount) || 0), 0));

  useEffect(() => {
    if (!upiId || upiAmount <= 0) {
      setQr(null);
      return;
    }
    const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${upiAmount.toFixed(2)}&cu=${currency}&tn=${encodeURIComponent(billLabel)}`;
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then(setQr, () => setQr(null));
  }, [upiId, upiAmount, payeeName, currency, billLabel]);

  const setRow = (i: number, p: Partial<PayRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const quickReceived = useMemo(() => {
    const due = cashDue;
    const notes = [Math.ceil(due / 100) * 100, Math.ceil(due / 500) * 500, Math.ceil(due / 2000) * 2000];
    return [...new Set(notes.filter((n) => n > due))].slice(0, 3);
  }, [cashDue]);

  async function pay() {
    setError("");
    setSaving(true);
    try {
      await onPay(rows.filter((r) => Number(r.amount) > 0).map((r) => ({ method: r.method, amount: Number(r.amount), reference: r.reference.trim() || null })));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Take payment · ${formatCurrency(total)}`}
      description={billLabel}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="success" size="lg" loading={saving} disabled={Math.abs(left) > 0.009 && total > 0} onClick={pay}>
            Payment received
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["cash", "upi", "card"] as const).map((m) => {
            const Icon = METHOD_ICONS[m];
            const only = rows.length === 1 && rows[0].method === m;
            return (
              <Button key={m} variant={only ? "primary" : "outline"} size="lg" onClick={() => setRows([{ method: m, amount: String(total), reference: "" }])}>
                <Icon className="h-5 w-5" /> {label(m)}
              </Button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
              <Field label="Paid by" className="w-36">
                <Select value={r.method} onChange={(e) => setRow(i, { method: e.target.value })}>
                  {["cash", "upi", "card", "other"].map((m) => (
                    <option key={m} value={m}>{label(m)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount" className="w-36">
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              </Field>
              {r.method !== "cash" && (
                <Field label="Reference" optional className="min-w-36 flex-1">
                  <Input value={r.reference} onChange={(e) => setRow(i, { reference: e.target.value })} placeholder="UPI / card ref." />
                </Field>
              )}
              {rows.length > 1 && (
                <Button variant="ghost" aria-label="Remove this payment" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((rs) => [...rs, { method: rs.some((r) => r.method === "upi") ? "card" : "upi", amount: left > 0 ? String(left) : "", reference: "" }])}
          >
            <Plus className="h-4 w-4" /> Split payment
          </Button>
        </div>

        <div className={cn("rounded-xl px-4 py-3 text-[15px] font-semibold", Math.abs(left) <= 0.009 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
          {Math.abs(left) <= 0.009 ? "Payments match the bill." : left > 0 ? `${formatCurrency(left)} still to be paid` : `${formatCurrency(-left)} more than the bill. Reduce an amount.`}
        </div>

        {cashRow && cashDue > 0 && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Cash received from customer (to work out change)</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" min={0} step="1" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} className="w-36" placeholder={String(cashDue)} />
              {quickReceived.map((n) => (
                <Button key={n} size="sm" variant="outline" onClick={() => setReceived(String(n))}>
                  {formatCurrency(n)}
                </Button>
              ))}
            </div>
            {change !== null && (
              <p className={cn("mt-2 text-lg font-bold", change < 0 ? "text-red-700" : "text-emerald-700")}>
                {change < 0 ? `${formatCurrency(-change)} short` : `Give back ${formatCurrency(change)}`}
              </p>
            )}
          </div>
        )}

        {qr && (
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="UPI QR code" className="h-32 w-32" />
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Customer can scan to pay {formatCurrency(upiAmount)}</p>
              <p>Pays to {upiId}. Check the payment on your UPI app before pressing “Payment received”.</p>
            </div>
          </div>
        )}
        {error && <Tip tone="danger">{error}</Tip>}
      </div>
    </Modal>
  );
}
