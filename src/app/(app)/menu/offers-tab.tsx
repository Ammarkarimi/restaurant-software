"use client";

import { useState } from "react";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Tip, Toggle } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { parseList } from "@/lib/menu";
import { offerRules, offerValue } from "@/lib/offers";
import { parseDays } from "@/lib/pricing";
import { cn, label } from "@/lib/utils";
import type { OfferDTO } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface OfferForm {
  id?: string;
  name: string;
  code: string;
  type: "percent" | "amount";
  value: string;
  maxDiscount: string;
  minBill: string;
  orderTypes: string[];
  days: number[];
  timed: boolean;
  startTime: string;
  endTime: string;
  validFrom: string;
  validTo: string;
  active: boolean;
}

const EXAMPLES: Array<{ name: string; patch: Partial<OfferForm> }> = [
  { name: "10% off above ₹1000", patch: { type: "percent", value: "10", minBill: "1000", maxDiscount: "200" } },
  { name: "Welcome ₹50 off", patch: { code: "WELCOME50", type: "amount", value: "50", minBill: "300" } },
  { name: "Weekday lunch 15% off", patch: { type: "percent", value: "15", days: [1, 2, 3, 4, 5], timed: true, startTime: "12:00", endTime: "15:30", orderTypes: ["dine_in"] } },
];

function toForm(o: OfferDTO | null): OfferForm {
  return {
    id: o?.id,
    name: o?.name ?? "",
    code: o?.code ?? "",
    type: o?.type === "amount" ? "amount" : "percent",
    value: o ? String(o.value) : "",
    maxDiscount: o?.maxDiscount ? String(o.maxDiscount) : "",
    minBill: o?.minBill ? String(o.minBill) : "",
    orderTypes: o ? parseList(o.orderTypes) : [],
    days: o ? parseDays(o.days) : [],
    timed: !!o?.startTime,
    startTime: o?.startTime ?? "12:00",
    endTime: o?.endTime ?? "15:00",
    validFrom: o?.validFrom ?? "",
    validTo: o?.validTo ?? "",
    active: o?.active ?? true,
  };
}

function OfferDialog({ initial, onClose, onSaved }: { initial: OfferForm; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<OfferForm>) => setF((x) => ({ ...x, ...p }));
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm font-semibold transition", on ? "border-primary-500 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-600 hover:border-primary-300");

  async function save() {
    setSaving(true);
    try {
      const body = {
        name: f.name,
        code: f.code.trim() || null,
        type: f.type,
        value: Number(f.value),
        maxDiscount: f.type === "percent" && f.maxDiscount ? Number(f.maxDiscount) : null,
        minBill: Number(f.minBill) || 0,
        orderTypes: f.orderTypes,
        days: f.days,
        startTime: f.timed ? f.startTime : null,
        endTime: f.timed ? f.endTime : null,
        validFrom: f.validFrom || null,
        validTo: f.validTo || null,
        active: f.active,
      };
      if (f.id) await api(`/api/offers/${f.id}`, { method: "PUT", body });
      else await api("/api/offers", { body });
      toast("Offer saved");
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
      title={f.id ? `Edit ${initial.name}` : "New offer"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!f.name.trim() || !(Number(f.value) > 0)} onClick={save}>Save offer</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!f.id && !f.name && (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <span className="self-center text-sm text-slate-500">Start from:</span>
            {EXAMPLES.map((ex) => (
              <Button key={ex.name} size="sm" variant="outline" onClick={() => set({ name: ex.name, ...ex.patch })}>
                {ex.name}
              </Button>
            ))}
          </div>
        )}
        <Field label="Offer name" hint="Printed on the bill">
          <Input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoFocus />
        </Field>
        <Field label="Coupon code" optional hint="With a code, staff type it when the guest gives it. Without one, it shows in the offers list.">
          <Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} maxLength={20} placeholder="e.g. WELCOME50" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Discount</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={f.type === "percent" ? "primary" : "outline"} onClick={() => set({ type: "percent" })}>Percent (%)</Button>
            <Button variant={f.type === "amount" ? "primary" : "outline"} onClick={() => set({ type: "amount" })}>Fixed amount (₹)</Button>
            <Input type="number" min={0} step="0.01" value={f.value} onChange={(e) => set({ value: e.target.value })} className="w-28" aria-label="Discount value" placeholder={f.type === "percent" ? "%" : "₹"} />
            {f.type === "percent" && (
              <>
                <span className="text-sm text-slate-600">up to ₹</span>
                <Input type="number" min={0} step="1" value={f.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} className="w-28" aria-label="Most it takes off" placeholder="no limit" />
              </>
            )}
          </div>
        </div>
        <Field label="Minimum bill" optional hint="Items total needed, before tax">
          <Input type="number" min={0} step="1" value={f.minBill} onChange={(e) => set({ minBill: e.target.value })} placeholder="0" />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Order types <span className="font-normal text-slate-500">(empty = all)</span></p>
          <div className="flex flex-wrap gap-2">
            {["dine_in", "takeaway", "delivery"].map((t) => (
              <button key={t} type="button" className={chip(f.orderTypes.includes(t))} onClick={() => set({ orderTypes: f.orderTypes.includes(t) ? f.orderTypes.filter((x) => x !== t) : [...f.orderTypes, t] })}>
                {label(t)}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-semibold text-slate-700">Days <span className="font-normal text-slate-500">(empty = every day)</span></p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" className={chip(f.days.includes(d))} onClick={() => set({ days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] })}>
                {DAYS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Toggle checked={f.timed} onChange={(v) => set({ timed: v })} label="Only between certain times" />
          {f.timed && (
            <div className="mt-2 flex items-center gap-2">
              <Input type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-36" aria-label="From" />
              <span className="text-slate-500">to</span>
              <Input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-36" aria-label="To" />
            </div>
          )}
        </div>
        <Field label="Starts on" optional>
          <Input type="date" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
        </Field>
        <Field label="Ends on" optional>
          <Input type="date" value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function OffersTab({ offers, onChanged }: { offers: OfferDTO[]; onChanged: () => void }) {
  const { toast, confirm } = useApp();
  const [editing, setEditing] = useState<OfferForm | null>(null);

  async function toggle(o: OfferDTO) {
    try {
      await api(`/api/offers/${o.id}`, { method: "PATCH", body: { active: !o.active } });
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(o: OfferDTO) {
    const ok = await confirm({ title: `Delete ${o.name}?`, message: "Bills that used it keep their discount.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/offers/${o.id}`, { method: "DELETE" });
      toast("Offer deleted");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tip>
          Saved offers appear when the cashier taps <b>Add discount</b> on an order, with a note when they cannot be used yet (bill too small, wrong time). Offers with a coupon
          code are applied by typing the code. The bill shows the offer name.
        </Tip>
        <Button onClick={() => setEditing(toForm(null))}>
          <Plus className="h-5 w-5" /> New offer
        </Button>
      </div>
      {offers.length === 0 ? (
        <EmptyState icon={<BadgePercent className="h-6 w-6" />} title="No offers yet" description="For example 10% off above ₹1000, a WELCOME50 coupon, or a weekday lunch offer." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => (
            <Card key={o.id} className={cn("p-4", !o.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
                    {o.name}
                    {o.code && <Badge variant="purple">Code {o.code}</Badge>}
                    {!o.active && <Badge>Off</Badge>}
                  </p>
                  <p className="font-semibold text-primary-700">{offerValue(o)}</p>
                  <p className="text-sm text-slate-500">{offerRules(o) || "Any bill, any time"}</p>
                  <p className="mt-1 text-xs text-slate-400">Used on {o.timesUsed} bill{o.timesUsed === 1 ? "" : "s"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(toForm(o))} aria-label={`Edit ${o.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(o)} aria-label={`Delete ${o.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="sm" variant={o.active ? "outline" : "success"} onClick={() => toggle(o)}>
                    {o.active ? "Switch off" : "Switch on"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <OfferDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
