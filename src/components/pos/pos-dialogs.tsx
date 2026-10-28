"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Banknote, BookUser, CreditCard, Minus, Plus, QrCode, Smartphone, Split, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, Tip } from "@/components/ui";
import { FoodMark } from "@/components/food-mark";
import { round2 } from "@/lib/billing";
import { addonsTotal, choiceHint, chooseAddons, parseAddonOptions, parseVariants, type AddonGroupData, type ChosenAddon } from "@/lib/menu";
import { cn, formatCurrency, label } from "@/lib/utils";
import { api } from "@/lib/client";
import type { CustomerLookup, MenuItemDTO, OfferDTO, OrderItemDTO, TableDTO } from "@/lib/types";
import { offerProblem, offerRules, offerValue } from "@/lib/offers";

/** A dish with portions or add-ons: choose them, see the price, add to the order. */
export function ItemOptionsDialog({
  item,
  groups,
  priceOf,
  onAdd,
  onClose,
}: {
  item: Pick<MenuItemDTO, "name" | "variants" | "foodType" | "description">;
  groups: AddonGroupData[];
  /** The dish or portion price under any special prices in force. */
  priceOf: (variant: string | null) => number | null;
  onAdd: (choice: { variant: string | null; addons: ChosenAddon[]; picks: Array<{ groupId: string; name: string }>; unitPrice: number; quantity: number }) => void;
  onClose: () => void;
}) {
  const variants = parseVariants(item.variants);
  const [variant, setVariant] = useState<string | null>(variants.length === 1 ? variants[0].name : null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(false);

  const picks = Object.entries(picked).flatMap(([groupId, names]) => names.map((name) => ({ groupId, name })));
  const result = chooseAddons(item.name, groups, picks);
  const base = variants.length ? (variant ? priceOf(variant) : null) : priceOf(null);
  const extras = "addons" in result ? addonsTotal(result.addons) : addonsTotal(groups.flatMap((g) => parseAddonOptions(g.options).filter((o) => picked[g.id]?.includes(o.name)).map((o) => ({ group: g.name, ...o }))));
  const unitPrice = round2((base ?? 0) + extras);
  const message = "error" in result ? result.error.replace(`${item.name}: `, "") : null;
  const problem = variants.length && !variant ? "Choose a portion" : message ? message[0].toUpperCase() + message.slice(1) : null;

  function toggle(g: AddonGroupData, name: string) {
    setPicked((p) => {
      const mine = p[g.id] ?? [];
      if (mine.includes(name)) return { ...p, [g.id]: mine.filter((n) => n !== name) };
      // Pick-one groups swap the choice; others stop at their maximum.
      if (g.maxSelect === 1) return { ...p, [g.id]: [name] };
      if (g.maxSelect > 0 && mine.length >= g.maxSelect) return p;
      return { ...p, [g.id]: [...mine, name] };
    });
  }

  function add() {
    setTried(true);
    if (problem || !("addons" in result) || base === null) return;
    onAdd({ variant, addons: result.addons, picks, unitPrice, quantity });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><FoodMark type={item.foodType} /> {item.name}</span>}
      description={item.description ?? undefined}
      size="md"
      footer={
        <div className="flex w-full items-center gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="One less">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-lg font-bold">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" aria-label="One more">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button size="lg" className="ml-auto" onClick={add} disabled={tried && !!problem}>
            Add · {formatCurrency(unitPrice * quantity)}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {variants.length > 0 && (
          <div>
            <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              Portion <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">Required</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {variants.map((v) => {
                const price = priceOf(v.name);
                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setVariant(v.name)}
                    className={cn("flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-[15px] font-semibold transition", variant === v.name ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:border-primary-300")}
                  >
                    <span>{v.name}</span>
                    <span>
                      {price !== null && price !== v.price && <s className="mr-1 text-xs font-normal text-slate-400">{formatCurrency(v.price)}</s>}
                      {formatCurrency(price ?? v.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {groups.map((g) => {
          const mine = picked[g.id] ?? [];
          return (
            <div key={g.id}>
              <p className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
                {g.name}
                <span className={cn("rounded-full px-2 text-xs", g.minSelect > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>{choiceHint(g)}</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {parseAddonOptions(g.options).map((o) => {
                  const on = mine.includes(o.name);
                  return (
                    <button
                      key={o.name}
                      type="button"
                      onClick={() => toggle(g, o.name)}
                      className={cn("flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left text-[15px] transition", on ? "border-primary-500 bg-primary-50 font-semibold" : "border-slate-200 hover:border-primary-300")}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center border-2", g.maxSelect === 1 ? "rounded-full" : "rounded", on ? "border-primary-600 bg-primary-600" : "border-slate-300")}>
                          {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        {o.name}
                      </span>
                      <span className="text-sm text-slate-600">{o.price > 0 ? `+${formatCurrency(o.price)}` : "Free"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {tried && problem && <Tip tone="warning">{problem}</Tip>}
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
  source: string;
  sourceRef: string;
}

const SOURCE_CHOICES = ["counter", "phone", "zomato", "swiggy", "app"];

export function CustomerDialog({
  initial,
  isDelivery,
  showSource,
  onSave,
  onClose,
}: {
  initial: CustomerForm;
  isDelivery: boolean;
  showSource: boolean;
  onSave: (f: CustomerForm) => Promise<void> | void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<CustomerLookup[]>([]);
  const [lookup, setLookup] = useState("");
  const set = (p: Partial<CustomerForm>) => setForm((f) => ({ ...f, ...p }));

  // Known guests: look them up as the phone number or name is typed.
  useEffect(() => {
    const q = lookup.trim();
    if (q.length < 3) {
      setMatches([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ customers: CustomerLookup[] }>(`/api/customers?q=${encodeURIComponent(q)}`).then(
        (r) => setMatches(r.customers.slice(0, 5)),
        () => setMatches([])
      );
    }, 250);
    return () => clearTimeout(t);
  }, [lookup]);

  function pick(c: CustomerLookup) {
    set({ customerName: c.name ?? form.customerName, customerPhone: c.phone, customerAddress: c.address ?? form.customerAddress });
    setLookup("");
    setMatches([]);
  }

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
        {showSource && (
          <>
            <Field label="Order from">
              <Select value={form.source} onChange={(e) => set({ source: e.target.value })}>
                {[...new Set([...SOURCE_CHOICES, form.source])].map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </Select>
            </Field>
            {form.source !== "counter" && form.source !== "phone" && form.source !== "qr" ? (
              <Field label={`${label(form.source)} order ID`} optional hint="Printed on the kitchen ticket and bill">
                <Input value={form.sourceRef} onChange={(e) => set({ sourceRef: e.target.value })} maxLength={40} />
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
          </>
        )}
        <Field label="Phone" optional hint="Saves the customer, for loyalty points and WhatsApp bills">
          <Input
            type="tel"
            value={form.customerPhone}
            onChange={(e) => {
              set({ customerPhone: e.target.value });
              setLookup(e.target.value);
            }}
            autoFocus
          />
        </Field>
        <Field label="Customer name" optional>
          <Input
            value={form.customerName}
            onChange={(e) => {
              set({ customerName: e.target.value });
              setLookup(e.target.value);
            }}
          />
        </Field>
        {matches.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Known customers — tap to fill in</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {matches.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-primary-50">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{c.name || "No name"}</span>
                      <span className="block truncate text-sm text-slate-500">{c.phone}{c.address ? ` · ${c.address}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      {c.visits} visit{c.visits === 1 ? "" : "s"}
                      {c.points > 0 && <span className="block font-semibold text-emerald-700">{c.points} points</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
  offers,
  offerContext,
  currentOfferId,
  handLimit = 100,
  onApplyOffer,
  onSave,
  onClose,
}: {
  /** Most this person may take off by hand, in %. */
  handLimit?: number;
  initial: { type: string; value: number; reason: string };
  itemsTotal: number;
  /** Saved offers; null while they load. */
  offers: OfferDTO[] | null;
  offerContext: { type: string; timezone: string; today: string };
  currentOfferId: string | null;
  onApplyOffer: (o: { offerId: string | null } | { offerCode: string }) => Promise<void>;
  onSave: (d: { type: string; value: number; reason: string }) => Promise<void> | void;
  onClose: () => void;
}) {
  const [type, setType] = useState(initial.type);
  const [value, setValue] = useState(initial.value && !currentOfferId ? String(initial.value) : "");
  const [reason, setReason] = useState(currentOfferId ? "" : initial.reason);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const n = Number(value) || 0;
  const amount = type === "percent" ? round2((itemsTotal * Math.min(n, 100)) / 100) : Math.min(n, itemsTotal);
  const asPercent = type === "percent" ? n : itemsTotal > 0 ? (n / itemsTotal) * 100 : 100;
  const invalid = n < 0 || (type === "percent" && n > 100) || asPercent > handLimit + 0.001;
  const listed = (offers ?? []).filter((o) => o.active && !o.code);

  async function run(key: string, fn: () => Promise<void> | void) {
    setSaving(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Discount & offers"
      description={`On items worth ${formatCurrency(itemsTotal)}`}
      size="md"
      footer={
        <>
          {(initial.value > 0 || currentOfferId) && (
            <Button variant="ghost" className="mr-auto text-red-600" loading={saving === "remove"} onClick={() => run("remove", () => (currentOfferId ? onApplyOffer({ offerId: null }) : onSave({ type, value: 0, reason: "" })))}>
              Remove discount
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {handLimit > 0 && (
            <Button loading={saving === "manual"} disabled={invalid || n <= 0} onClick={() => run("manual", () => onSave({ type, value: n, reason: reason.trim() }))}>
              Apply discount
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {(listed.length > 0 || (offers ?? []).some((o) => o.active && o.code)) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Offers</p>
            {listed.map((o) => {
              const problem = offerProblem(o, { ...offerContext, itemsTotal });
              const applied = currentOfferId === o.id;
              return (
                <div key={o.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", applied ? "border-emerald-400 bg-emerald-50" : "border-slate-200")}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {o.name} <span className="font-normal text-primary-700">· {offerValue(o)}</span>
                    </p>
                    <p className={cn("text-xs", problem ? "text-amber-700" : "text-slate-500")}>{problem ?? (offerRules(o) || "Any bill")}</p>
                  </div>
                  {applied ? (
                    <span className="text-sm font-bold text-emerald-700">Applied</span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!problem} loading={saving === o.id} onClick={() => run(o.id, () => onApplyOffer({ offerId: o.id }))}>
                      Apply
                    </Button>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" aria-label="Coupon code" maxLength={20} onKeyDown={(e) => e.key === "Enter" && code.trim() && run("code", () => onApplyOffer({ offerCode: code.trim() }))} />
              <Button variant="outline" className="whitespace-nowrap" disabled={!code.trim()} loading={saving === "code"} onClick={() => run("code", () => onApplyOffer({ offerCode: code.trim() }))}>
                Apply code
              </Button>
            </div>
          </div>
        )}
        {offers === null && <p className="text-sm text-slate-500">Loading offers…</p>}
        {error && <Tip tone="danger">{error}</Tip>}
        {handLimit === 0 ? (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">Discounts by hand need the owner / manager. You can apply the offers above.</p>
        ) : (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700">
            {listed.length ? "Or a discount by hand" : "Discount by hand"}
            {handLimit < 100 && <span className="font-normal text-slate-500"> · you can give up to {handLimit}%</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["percent", "amount"] as const).map((t) => (
              <Button key={t} variant={type === t ? "primary" : "outline"} onClick={() => setType(t)}>
                {t === "percent" ? "Percent (%)" : "Fixed amount"}
              </Button>
            ))}
          </div>
          {type === "percent" && (
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20, 25].filter((p) => p <= handLimit).map((p) => (
                <Button key={p} size="sm" variant={n === p ? "secondary" : "outline"} onClick={() => setValue(String(p))}>
                  {p}%
                </Button>
              ))}
            </div>
          )}
          <Field label={type === "percent" ? "Discount %" : "Discount amount"} hint={n > 0 && !invalid ? `Takes ${formatCurrency(amount)} off the bill` : undefined}>
            <Input type="number" min={0} max={type === "percent" ? 100 : undefined} step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Reason" optional hint="Saved in the activity history, e.g. regular customer, food was late">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        )}
      </div>
    </Modal>
  );
}

export function ChargesDialog({
  initial,
  isDelivery,
  onSave,
  onClose,
}: {
  initial: { packingCharge: number; deliveryCharge: number };
  isDelivery: boolean;
  onSave: (c: { packingCharge: number; deliveryCharge: number }) => Promise<void> | void;
  onClose: () => void;
}) {
  const [packing, setPacking] = useState(initial.packingCharge ? String(initial.packingCharge) : "");
  const [delivery, setDelivery] = useState(initial.deliveryCharge ? String(initial.deliveryCharge) : "");
  const [saving, setSaving] = useState(false);
  const invalid = Number(packing) < 0 || Number(delivery) < 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Packing & delivery charges"
      description="Added to this bill after the discount. Tax is charged on them like on the food."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            disabled={invalid}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ packingCharge: Number(packing) || 0, deliveryCharge: Number(delivery) || 0 });
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
        <Field label="Packing charge" hint="0 for none">
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={packing} onChange={(e) => setPacking(e.target.value)} autoFocus />
        </Field>
        <Field label="Delivery charge" hint={isDelivery ? "0 for free delivery" : "Only for delivery orders"}>
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function ServiceChargeDialog({
  current,
  usual,
  onSave,
  onClose,
}: {
  current: number;
  usual: number;
  onSave: (percent: number) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const n = Number(value);
  async function save(percent: number) {
    setSaving(true);
    setError("");
    try {
      await onSave(percent);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Service charge"
      description="Service charge is optional for guests in India. Remove it when a guest asks."
      size="sm"
      footer={
        <>
          {current > 0 && (
            <Button variant="ghost" className="mr-auto text-red-600" loading={saving} onClick={() => save(0)}>
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!(n >= 0 && n <= 50)} onClick={() => save(n)}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Service charge %">
          <Input type="number" min={0} max={50} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        {usual > 0 && current !== usual && (
          <Button size="sm" variant="outline" onClick={() => setValue(String(usual))}>
            Use the usual {usual}%
          </Button>
        )}
        {error && <Tip tone="danger">{error}</Tip>}
      </div>
    </Modal>
  );
}

export function PointsDialog({
  balance,
  maxUsable,
  minRedeem,
  initial,
  onSave,
  onClose,
}: {
  balance: number;
  maxUsable: number;
  minRedeem: number;
  initial: number;
  onSave: (points: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const most = Math.max(0, Math.floor(Math.min(balance, maxUsable)));
  const [value, setValue] = useState(initial ? String(initial) : String(most));
  const [saving, setSaving] = useState(false);
  const n = Math.floor(Number(value) || 0);
  const tooFew = balance < minRedeem;
  async function save(points: number) {
    setSaving(true);
    try {
      await onSave(points);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Use loyalty points"
      description={`The customer has ${balance} points. 1 point = ${formatCurrency(1)} off.`}
      size="sm"
      footer={
        <>
          {initial > 0 && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => save(0)}>
              Don&apos;t use points
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={tooFew || n <= 0 || n > most} onClick={() => save(n)}>
            Use {n > 0 ? n : ""} points
          </Button>
        </>
      }
    >
      {tooFew ? (
        <Tip tone="warning">Points can be used once the customer has {minRedeem} points.</Tip>
      ) : (
        <Field label="Points to use" hint={`At most ${most} on this bill`}>
          <Input type="number" min={1} max={most} step="1" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
      )}
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

const METHOD_ICONS: Record<string, typeof Banknote> = { cash: Banknote, upi: QrCode, card: CreditCard, account: BookUser };

export function PaymentDialog({
  total,
  upiId,
  payeeName,
  billLabel,
  currency,
  initialMethod = "cash",
  initialRows,
  title,
  submitLabel = "Payment received",
  account,
  onPay,
  onClose,
}: {
  total: number;
  /** The customer on the bill, so it can go on their account (pay later / wallet). Null without a phone number. */
  account?: { name: string; balance: number; creditLimit: number | null; canGiveCredit: boolean } | null;
  /** Start from these payments (when correcting how a paid bill was paid). */
  initialRows?: Array<{ method: string; amount: number; reference: string | null }>;
  title?: string;
  submitLabel?: string;
  /** "online" for orders that Zomato / Swiggy already collected. */
  initialMethod?: string;
  upiId: string | null;
  payeeName: string;
  billLabel: string;
  currency: string;
  onPay: (payments: Array<{ method: string; amount: number; reference: string | null }>) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PayRow[]>(
    initialRows?.length ? initialRows.map((r) => ({ method: r.method, amount: String(r.amount), reference: r.reference ?? "" })) : [{ method: initialMethod, amount: String(total), reference: "" }]
  );
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const quick = [...(initialMethod === "online" ? ["online"] : []), "cash", "upi", "card", ...(account ? ["account"] : [])];
  const methods = ["cash", "upi", "card", "online", ...(account ? ["account"] : []), "other"];
  const onAccount = round2(rows.filter((r) => r.method === "account").reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const afterBalance = account ? round2(account.balance - onAccount) : 0;
  const limit = account ? (account.creditLimit ?? (account.canGiveCredit ? Infinity : 0)) : 0;
  const overLimit = account && onAccount > 0 && afterBalance < -limit;
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
      title={title ?? `Take payment · ${formatCurrency(total)}`}
      description={billLabel}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="success" size="lg" loading={saving} disabled={(Math.abs(left) > 0.009 && total > 0) || !!overLimit} onClick={pay}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className={cn("grid gap-2", quick.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          {quick.map((m) => {
            const Icon = METHOD_ICONS[m] ?? Smartphone;
            const only = rows.length === 1 && rows[0].method === m;
            return (
              <Button key={m} variant={only ? "primary" : "outline"} size="lg" onClick={() => setRows([{ method: m, amount: String(total), reference: "" }])}>
                <Icon className="h-5 w-5" /> {m === "account" ? "Pay later" : label(m)}
              </Button>
            );
          })}
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
              <Field label="Paid by" className="w-44">
                <Select value={r.method} onChange={(e) => setRow(i, { method: e.target.value })}>
                  {[...new Set([...methods, r.method])].map((m) => (
                    <option key={m} value={m}>{label(m)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount" className="w-36">
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
              </Field>
              {r.method !== "cash" && r.method !== "account" && (
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

        {account && onAccount > 0 && (
          <div className={cn("rounded-xl border px-4 py-3 text-sm", overLimit ? "border-red-200 bg-red-50 text-red-800" : "border-violet-200 bg-violet-50 text-violet-900")}>
            <p className="font-semibold">
              {formatCurrency(onAccount)} goes on {account.name}&apos;s account.
            </p>
            <p>
              {account.balance > 0 ? `Wallet now ${formatCurrency(account.balance)}` : account.balance < 0 ? `Already owes ${formatCurrency(-account.balance)}` : "Nothing owed now"}
              {" → "}
              {afterBalance >= 0 ? `wallet left ${formatCurrency(afterBalance)}` : `will owe ${formatCurrency(-afterBalance)}`}
              {account.creditLimit !== null && ` (limit ${formatCurrency(account.creditLimit)})`}
            </p>
            {overLimit && (
              <p className="mt-1 font-semibold">
                {account.creditLimit === null ? "Only the owner / manager can let this customer pay later." : "This is more than their credit limit."}
              </p>
            )}
          </div>
        )}

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

export interface TransferTable extends TableDTO {
  order: { id: string; number: number; total: number } | null;
}

/** Split the bill, merge with another table or move a few dishes: pick items, then where they go. */
export function TransferDialog({
  items,
  tables,
  currentTableId,
  onTransfer,
  onClose,
}: {
  items: OrderItemDTO[];
  tables: TransferTable[];
  currentTableId: string | null;
  onTransfer: (body: { items: Array<{ itemId: string; quantity: number }>; to: { tableId: string } | { newBill: true } }) => Promise<void>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [to, setTo] = useState<string | null>(null); // table id, or "new"
  const [saving, setSaving] = useState(false);
  const count = Object.values(picked).reduce((s, n) => s + n, 0);
  const all = items.every((i) => (picked[i.id] ?? 0) === i.quantity);
  const others = tables.filter((t) => t.id !== currentTableId);
  const set = (id: string, n: number) => setPicked((p) => ({ ...p, [id]: n }));
  const target = to === "new" ? null : others.find((t) => t.id === to);

  async function go() {
    if (!to || count === 0) return;
    setSaving(true);
    try {
      await onTransfer({
        items: Object.entries(picked)
          .filter(([, n]) => n > 0)
          .map(([itemId, quantity]) => ({ itemId, quantity })),
        to: to === "new" ? { newBill: true } : { tableId: to },
      });
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Split bill or move items"
      description="Choose the dishes, then where they go. Kitchen tickets and prices move with them."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!to || count === 0 || (to === "new" && all)} onClick={go}>
            {to === "new" ? `Make a separate bill (${count})` : target?.order ? `Add to ${target.name} (${count})` : target ? `Move to ${target.name} (${count})` : "Move"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">1. Dishes to move</p>
            <Button size="sm" variant="ghost" onClick={() => setPicked(all ? {} : Object.fromEntries(items.map((i) => [i.id, i.quantity])))}>
              {all ? "Clear" : "Select all"}
            </Button>
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {items.map((i) => {
              const n = picked[i.id] ?? 0;
              return (
                <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <FoodMark type={i.foodType} />
                  <span className="min-w-0 flex-1 text-[15px]">
                    <span className="font-semibold">{i.name}</span>
                    {i.variant && <span className="text-slate-500"> ({i.variant})</span>}
                    <span className="block text-xs text-slate-500">
                      {i.quantity} on this order · {formatCurrency(i.price)} each
                    </span>
                  </span>
                  <button onClick={() => set(i.id, Math.max(0, n - 1))} disabled={n === 0} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label={`One less ${i.name}`}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className={cn("w-8 text-center font-bold", n > 0 ? "text-primary-700" : "text-slate-400")}>{n}</span>
                  <button onClick={() => set(i.id, Math.min(i.quantity, n + 1))} disabled={n === i.quantity} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40" aria-label={`One more ${i.name}`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">2. Where they go</p>
          <Button
            variant={to === "new" ? "primary" : "outline"}
            className="mb-2 w-full justify-start"
            disabled={all}
            onClick={() => setTo("new")}
          >
            <Split className="h-4 w-4" /> Separate bill{currentTableId ? " at this table" : ""} — these guests pay on their own
          </Button>
          {others.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {others.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTo(t.id)}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-center transition",
                    to === t.id ? "border-primary-500 bg-primary-50" : t.order ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white hover:border-primary-300"
                  )}
                >
                  <span className="block font-bold text-slate-900">{t.name}</span>
                  <span className="block text-xs text-slate-500">{t.order ? `Running · ${formatCurrency(t.order.total)}` : "Free"}</span>
                </button>
              ))}
            </div>
          )}
          {target?.order && <p className="mt-2 text-sm text-slate-600">The dishes join {target.name}&apos;s running order #{target.order.number}.</p>}
        </div>
      </div>
    </Modal>
  );
}
