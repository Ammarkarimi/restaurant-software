"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { shrinkPhoto } from "@/lib/photo-client";
import { STOCK_UNITS } from "@/lib/stock";
import { formatCurrency, label } from "@/lib/utils";

interface StockOption {
  id: string;
  name: string;
  unit: string;
}

interface SupplierOption {
  id: string;
  name: string;
  active: boolean;
}

interface ScanResult {
  supplier: { id: string | null; name: string; phone: string; gstin: string };
  invoiceNo: string;
  lines: Array<{ name: string; billQuantity: number; billUnit: string; stockItemId: string | null; quantity: number; rate: number; amount: number }>;
  tax: number;
  /** GST from the bill spread into the item rates (it is part of what the stock cost). */
  taxIncluded: number;
  total: number;
  note: string;
}

interface Line {
  name: string;
  billText: string;
  /** A stock item id, "new" to add it to the stock list, or "" to leave the line out. */
  stockItemId: string;
  newUnit: string;
  quantity: string;
  rate: string;
}

const NEW = "new";

/**
 * Photo of a supplier's bill → lines matched to stock items → received into stock in one go
 * (a purchase is made and received, the supplier's balance and any payment saved as usual).
 */
export function ScanBillDialog({ stock, suppliers, onClose, onSaved }: { stock: StockOption[]; suppliers: SupplierOption[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Array<{ mediaType: "image/jpeg"; data: string; preview: string }>>([]);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState("");
  const [paidMethod, setPaidMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const f of [...files].slice(0, 3 - photos.length)) next.push(await shrinkPhoto(f));
    setPhotos(next);
  }

  async function read() {
    setReading(true);
    try {
      const r = await api<ScanResult>("/api/purchases/scan", { body: { photos: photos.map(({ mediaType, data }) => ({ mediaType, data })) } });
      setResult(r);
      setSupplierId(r.supplier.id ?? (r.supplier.name ? NEW : ""));
      setInvoiceNo(r.invoiceNo);
      setLines(
        r.lines.map((l) => {
          const unit = (STOCK_UNITS as readonly string[]).includes(l.billUnit) ? l.billUnit : "kg";
          return {
            name: l.name,
            billText: `${l.billQuantity} ${l.billUnit} · ${formatCurrency(l.amount)} on the bill`,
            stockItemId: l.stockItemId ?? NEW,
            newUnit: unit,
            quantity: String(l.quantity),
            rate: String(l.rate),
          };
        })
      );
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setReading(false);
  }

  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const kept = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0);
  const total = Math.round(kept.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0) * 100) / 100;

  async function save() {
    if (!result) return;
    setSaving(true);
    try {
      let sid = supplierId;
      if (sid === NEW) {
        const r = await api<{ supplier: { id: string } }>("/api/suppliers", { body: { name: result.supplier.name, phone: result.supplier.phone || null, gstin: result.supplier.gstin || null } });
        sid = r.supplier.id;
      }
      const fresh = kept.filter((l) => l.stockItemId === NEW);
      let items = stock;
      if (fresh.length) {
        await api("/api/stock", { body: { items: fresh.map((l) => ({ name: l.name, unit: l.newUnit, quantity: 0, costPerUnit: Number(l.rate) || 0 })) } }).catch((e: Error) => {
          // Already in the stock list under that name: use it.
          if (!/already/.test(e.message)) throw e;
        });
        items = (await api<{ items: StockOption[] }>("/api/stock")).items;
      }
      const idOf = (l: Line) => (l.stockItemId === NEW ? items.find((s) => s.name.toLowerCase() === l.name.toLowerCase())?.id : l.stockItemId);
      const payload = kept.map((l) => ({ stockItemId: idOf(l)!, quantity: Number(l.quantity), rate: Number(l.rate) || 0 })).filter((l) => l.stockItemId);
      // One line per stock item: two bill lines for the same item are added together.
      const merged = [...payload.reduce((m, l) => {
        const x = m.get(l.stockItemId);
        m.set(l.stockItemId, x ? { ...x, rate: (x.quantity * x.rate + l.quantity * l.rate) / (x.quantity + l.quantity), quantity: x.quantity + l.quantity } : l);
        return m;
      }, new Map<string, { stockItemId: string; quantity: number; rate: number }>()).values()];
      const { purchase } = await api<{ purchase: { id: string; number: number } }>("/api/purchases", { body: { supplierId: sid || null, supplierName: result.supplier.name || "Supplier", lines: merged, notes: "Read from the supplier's bill" } });
      await api(`/api/purchases/${purchase.id}/receive`, { body: { invoiceNo: invoiceNo || null, lines: merged, paidAmount: Number(paid) || 0, paidMethod } });
      toast(`Bill added to stock as purchase #${purchase.number}`);
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
      size="xl"
      title="Scan a supplier's bill"
      description="Take a photo of the bill. The lines are read for you; check them and add everything to stock in one go."
      footer={
        result ? (
          <>
            <span className="mr-auto text-sm text-slate-600">
              {kept.length} item(s) · {formatCurrency(total)}
              {result.total > 0 && Math.abs(result.total - total) > 1 && ` · bill total ${formatCurrency(result.total)}${result.tax ? ` incl. ${formatCurrency(result.tax)} tax` : ""}`}
            </span>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button loading={saving} disabled={!kept.length || (!supplierId && !result.supplier.name)} onClick={save}>Add to stock</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button loading={reading} disabled={!photos.length} onClick={read}>{reading ? "Reading the bill…" : "Read the bill"}</Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`Bill photo ${i + 1}`} className="h-40 w-32 rounded-md border border-slate-200 object-cover" />
                <button className="absolute right-1 top-1 rounded-lg bg-white/90 p-1" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remove photo">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button onClick={() => fileRef.current?.click()} className="flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <Camera className="h-6 w-6" /> {photos.length ? "Next page" : "Take photo"}
              </button>
            )}
          </div>
          <Tip>Lay the bill flat in good light and fill the photo with it. Printed and handwritten bills both work. Up to 3 photos for a long bill.</Tip>
        </div>
      ) : (
        <div className="space-y-4">
          {result.note && <Tip tone="warning">Could not read everything: {result.note}</Tip>}
          {result.taxIncluded > 0 && <Tip>The bill&apos;s GST ({formatCurrency(result.taxIncluded)}) is included in the item rates: restaurants on 5% GST can&apos;t claim it back, so it is part of what the stock cost.</Tip>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose…</option>
                {result.supplier.name && !result.supplier.id && <option value={NEW}>+ Add “{result.supplier.name}” as a supplier</option>}
                {suppliers.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bill number" optional>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const item = stock.find((s) => s.id === l.stockItemId);
              return (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3">
                  <div className="w-full text-sm">
                    <b className="text-slate-900">{l.name}</b> <span className="text-slate-500">· {l.billText}</span>
                  </div>
                  <Field label="Stock item" className="min-w-52 flex-1">
                    <Select value={l.stockItemId} onChange={(e) => set(i, { stockItemId: e.target.value })} aria-label={`Stock item for ${l.name}`}>
                      <option value="">Leave out</option>
                      <option value={NEW}>+ New stock item “{l.name}”</option>
                      {stock.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                    </Select>
                  </Field>
                  {l.stockItemId === NEW && (
                    <Field label="Unit" className="w-24">
                      <Select value={l.newUnit} onChange={(e) => set(i, { newUnit: e.target.value })}>
                        {STOCK_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label={`Quantity${item ? ` (${item.unit})` : ""}`} className="w-32">
                    <Input type="number" min={0} step="0.001" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Rate" className="w-28">
                    <Input type="number" min={0} step="0.01" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} />
                  </Field>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid now" optional hint="Leave empty if you pay the supplier later">
              <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
            <Field label="Paid by">
              <Select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)}>
                {["cash", "upi", "card", "bank"].map((m) => (
                  <option key={m} value={m}>{label(m)}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
