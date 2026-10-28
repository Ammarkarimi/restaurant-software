"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Bike, Check, IndianRupee, Minus, Plus, ReceiptText, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { FoodMark } from "@/components/food-mark";
import { Button, Field, Input, Modal, Select, Textarea, Tip } from "@/components/ui";
import { ItemOptionsDialog } from "@/components/pos/pos-dialogs";
import { api } from "@/lib/client";
import { addonText, groupsForItem, parseVariants, priceFor, type AddonGroupData, type ChosenAddon } from "@/lib/menu";
import { cn, formatCurrency, setCurrency } from "@/lib/utils";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  variants: string;
  foodType: string;
  available: boolean;
  /** The menu price when a special price (e.g. happy hours) changes it right now. */
  usualPrice: number | null;
  addonGroupIds: string;
  imageUrl: string | null;
}

interface Line {
  key: string;
  menuItemId: string;
  name: string;
  variant: string | null;
  price: number;
  quantity: number;
  addons: ChosenAddon[];
  picks: Array<{ groupId: string; name: string }>;
}

interface Placed {
  at: string;
  orderNumber: number;
  items: Array<{ name: string; variant: string | null; quantity: number; addons?: string }>;
}

type Mode = "table" | "menu" | "online" | "kiosk";

interface TableBill {
  billNumber: string | null;
  total: number;
  due: number;
  items: Array<{ name: string; variant: string | null; quantity: number; amount: number }>;
  upi: string | null;
}

/** Pickup / delivery times for the rest of today, every 30 minutes, starting 30 minutes from now. */
function timeSlots(timeZone: string) {
  const out: Array<{ value: string; label: string }> = [];
  const start = Math.ceil((Date.now() + 30 * 60_000) / (30 * 60_000)) * 30 * 60_000;
  const fmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone });
  const today = day.format(Date.now());
  for (let t = start; day.format(t) === today && out.length < 30; t += 30 * 60_000) out.push({ value: new Date(t).toISOString(), label: fmt.format(t) });
  return out;
}

export function GuestMenu({
  slug,
  restaurant,
  categories,
  addonGroups,
  table,
  mode,
  ordering,
  online,
}: {
  slug: string;
  restaurant: { name: string; address: string; phone: string | null; logoUrl: string | null; currency: string; taxNote: string | null };
  categories: Array<{ id: string; name: string; items: Dish[] }>;
  addonGroups: AddonGroupData[];
  table: { token: string; name: string } | null;
  mode: Mode;
  ordering: boolean;
  online: { delivery: boolean; minOrder: number; packingCharge: number; deliveryCharge: number; timezone: string };
}) {
  setCurrency(restaurant.currency);
  const router = useRouter();
  const selfOrder = mode === "online" || mode === "kiosk";
  const [checkout, setCheckout] = useState({ phone: "", type: "takeaway" as "takeaway" | "delivery", address: "", when: "", note: "" });
  const [kioskDone, setKioskDone] = useState<{ number: number; total: number } | null>(null);
  const [bill, setBill] = useState<TableBill | null>(null);
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const [portionFor, setPortionFor] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [called, setCalled] = useState<string | null>(null);
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const storeKey = table ? `qr-orders:${slug}:${table.token}` : null;
  const sections = useRef<Record<string, HTMLElement | null>>({});

  // Orders this phone already placed at this table today, so the guest can see them.
  useEffect(() => {
    try {
      if (mode === "online") {
        setName(localStorage.getItem("qr-guest-name") || "");
        setCheckout((c) => ({ ...c, phone: localStorage.getItem("online-guest-phone") || "", address: localStorage.getItem("online-guest-address") || "" }));
      }
      if (!storeKey) return;
      const saved = JSON.parse(localStorage.getItem(storeKey) || "[]") as Placed[];
      const since = Date.now() - 6 * 60 * 60 * 1000;
      setPlaced(saved.filter((p) => new Date(p.at).getTime() > since));
      setName(localStorage.getItem("qr-guest-name") || "");
    } catch {
      // private mode
    }
  }, [storeKey, mode]);

  // Scan & pay: once the table's bill is printed, guests can pay it by UPI from here.
  useEffect(() => {
    if (!table) return;
    const load = () => api<{ bill: TableBill | null }>(`/api/public/table-bill/${slug}?t=${encodeURIComponent(table.token)}`).then((r) => setBill(r.bill), () => null);
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20_000);
    return () => clearInterval(t);
  }, [table, slug]);

  // The kiosk starts again for the next guest.
  useEffect(() => {
    if (!kioskDone) return;
    const t = setTimeout(() => setKioskDone(null), 20_000);
    return () => clearTimeout(t);
  }, [kioskDone]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => (!vegOnly || i.foodType === "veg") && (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))) }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, vegOnly]);

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);

  function add(dish: Dish, variant: string | null, price: number, addons: ChosenAddon[] = [], picks: Line["picks"] = [], quantity = 1) {
    const key = `${dish.id}:${variant ?? ""}:${addons.map((a) => a.name).join("+")}`;
    setCart((c) => {
      const same = c.find((l) => l.key === key);
      if (same) return c.map((l) => (l === same ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l));
      return [...c, { key, menuItemId: dish.id, name: dish.name, variant, price, quantity: Math.min(20, quantity), addons, picks }];
    });
  }
  function change(key: string, delta: number) {
    setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: Math.min(20, l.quantity + delta) }])));
  }
  function pick(dish: Dish) {
    if (!dish.available) return;
    if (parseVariants(dish.variants).length || groupsForItem(dish, addonGroups).length) setPortionFor(dish);
    else add(dish, null, dish.price);
  }

  async function placeSelfOrder() {
    setSending(true);
    setError("");
    try {
      const r = await api<{ orderNumber: number; total: number; track: string }>(`/api/public/online-order/${slug}`, {
        body: {
          mode,
          type: mode === "kiosk" ? "takeaway" : checkout.type,
          name: name.trim() || null,
          phone: checkout.phone.trim() || null,
          address: checkout.type === "delivery" ? checkout.address.trim() : null,
          scheduledFor: checkout.when || null,
          note: checkout.note.trim() || null,
          items: cart.map((l) => ({ menuItemId: l.menuItemId, variant: l.variant, quantity: l.quantity, addons: l.picks })),
        },
      });
      setCart([]);
      setCartOpen(false);
      if (mode === "kiosk") {
        setName("");
        setCheckout((c) => ({ ...c, phone: "", note: "" }));
        setKioskDone({ number: r.orderNumber, total: r.total });
        return;
      }
      try {
        if (name.trim()) localStorage.setItem("qr-guest-name", name.trim());
        localStorage.setItem("online-guest-phone", checkout.phone.trim());
        if (checkout.type === "delivery") localStorage.setItem("online-guest-address", checkout.address.trim());
      } catch {
        // private mode
      }
      router.push(`/o/${encodeURIComponent(r.track)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function placeOrder() {
    if (selfOrder) return placeSelfOrder();
    if (!table) return;
    setSending(true);
    setError("");
    try {
      const r = await api<{ orderNumber: number; items: Placed["items"] }>(`/api/public/order/${slug}`, {
        body: { table: table.token, name: name.trim() || null, items: cart.map((l) => ({ menuItemId: l.menuItemId, variant: l.variant, quantity: l.quantity, addons: l.picks })) },
      });
      const next = [{ at: new Date().toISOString(), orderNumber: r.orderNumber, items: r.items }, ...placed];
      setPlaced(next);
      setCart([]);
      setCartOpen(false);
      try {
        if (storeKey) localStorage.setItem(storeKey, JSON.stringify(next.slice(0, 20)));
        if (name.trim()) localStorage.setItem("qr-guest-name", name.trim());
      } catch {
        // private mode
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function call(type: "waiter" | "bill" | "paid") {
    if (!table) return;
    try {
      await api(`/api/public/call/${slug}`, { body: { table: table.token, type } });
      setCalled(type);
      setTimeout(() => setCalled(null), 8000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-white px-4 pb-4 pt-6 text-center shadow-sm">
        {restaurant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logoUrl} alt="" className="mx-auto mb-2 h-16 max-w-[60%] object-contain" />
        ) : (
          <div className="mx-auto mb-2 w-fit rounded-2xl bg-primary-600 p-3 text-white">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
        {restaurant.address && <p className="text-sm text-slate-500">{restaurant.address}</p>}
        {table && <p className="mt-2 inline-block rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">Table {table.name}</p>}
        {mode === "online" && <p className="mt-2 inline-block rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">Order online · {online.delivery ? "pickup or delivery" : "pickup"}</p>}
        {mode === "kiosk" && <p className="mt-2 inline-block rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">Order here · pay at the counter</p>}
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {placed.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 font-bold text-emerald-900">
              <Check className="h-5 w-5" /> Order sent. Our staff will confirm it shortly.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-emerald-900">
              {placed.map((p) => (
                <li key={p.at}>
                  <span className="text-emerald-700">{new Date(p.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}:</span>{" "}
                  {p.items.map((i) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ""}${addonText(i.addons) ? ` + ${addonText(i.addons)}` : ""}`).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        {bill && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <p className="flex items-center justify-between font-bold text-slate-900">
              <span className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-emerald-600" /> Your bill {bill.billNumber}
              </span>
              <span>{formatCurrency(bill.total)}</span>
            </p>
            <details className="mt-1 text-sm text-slate-600">
              <summary className="cursor-pointer">{bill.items.reduce((s, i) => s + i.quantity, 0)} items</summary>
              <ul className="mt-1 space-y-0.5">
                {bill.items.map((i, n) => (
                  <li key={n} className="flex justify-between">
                    <span>
                      {i.quantity} × {i.name}
                      {i.variant && ` (${i.variant})`}
                    </span>
                    <span>{formatCurrency(i.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
            {bill.due > 0 && bill.upi && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={bill.upi} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2.5 font-bold text-white">
                  <IndianRupee className="h-4 w-4" /> Pay by UPI
                </a>
                <Button variant="outline" onClick={() => call("paid")} disabled={called === "paid"}>
                  {called === "paid" ? "Staff told" : "I have paid"}
                </Button>
              </div>
            )}
            {bill.due > 0 && !bill.upi && <p className="mt-2 text-sm text-slate-500">Please pay at the counter or ask the staff.</p>}
          </div>
        )}

        {table && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => call("waiter")} disabled={called === "waiter"}>
              <BellRing className="h-5 w-5" /> {called === "waiter" ? "Waiter called" : "Call waiter"}
            </Button>
            <Button variant="outline" onClick={() => call("bill")} disabled={called === "bill"}>
              <ReceiptText className="h-5 w-5" /> {called === "bill" ? "Bill requested" : "Ask for the bill"}
            </Button>
          </div>
        )}
        {error && <Tip tone="danger">{error}</Tip>}

        <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-slate-50/95 px-4 py-2 backdrop-blur">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the menu" className="pl-9" aria-label="Search the menu" />
            </div>
            <button
              onClick={() => setVegOnly((v) => !v)}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold", vegOnly ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700")}
            >
              <FoodMark type="veg" /> Veg only
            </button>
          </div>
          {!query && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {shown.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActive(c.id);
                    sections.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold", active === c.id ? "bg-primary-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200")}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {shown.length === 0 && <p className="py-10 text-center text-slate-500">No dish matches.</p>}
        {shown.map((c) => (
          <section key={c.id} ref={(el) => void (sections.current[c.id] = el)} className="scroll-mt-28">
            <h2 className="mb-2 text-lg font-bold text-slate-900">{c.name}</h2>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {c.items.map((d) => {
                const inCart = cart.filter((l) => l.menuItemId === d.id).reduce((s, l) => s + l.quantity, 0);
                const portions = parseVariants(d.variants);
                return (
                  <li key={d.id} className={cn("flex items-start gap-3 p-3", !d.available && "opacity-50")}>
                    <FoodMark type={d.foodType} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{d.name}</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {d.usualPrice !== null && <s className="mr-1 font-normal text-slate-400">{formatCurrency(d.usualPrice)}</s>}
                        {portions.length ? portions.map((p) => `${p.name} ${formatCurrency(p.price)}`).join(" · ") : formatCurrency(d.price)}
                      </p>
                      {d.description && <p className="mt-0.5 text-sm text-slate-500">{d.description}</p>}
                      {groupsForItem(d, addonGroups).length > 0 && <p className="mt-0.5 text-xs text-slate-400">Customisable</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      {d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
                      )}
                      {!d.available ? (
                        <span className="text-sm font-semibold text-red-600">Sold out</span>
                      ) : (
                        ordering && (
                          <Button size="sm" variant={inCart ? "primary" : "outline"} onClick={() => pick(d)} aria-label={`Add ${d.name}`}>
                            {inCart ? `${inCart} added` : "Add"} <Plus className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <p className="pb-4 text-center text-xs text-slate-400">
          {restaurant.taxNote}
          {restaurant.phone && ` · Call us: ${restaurant.phone}`}
        </p>
      </div>

      {ordering && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3">
          <Button size="lg" className="mx-auto flex w-full max-w-2xl justify-between" onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" /> {count} item{count === 1 ? "" : "s"}
            </span>
            <span>View order · {formatCurrency(subtotal)}</span>
          </Button>
        </div>
      )}

      {portionFor && (
        <ItemOptionsDialog
          item={portionFor}
          groups={groupsForItem(portionFor, addonGroups)}
          priceOf={(variant) => priceFor(portionFor, variant)}
          onClose={() => setPortionFor(null)}
          onAdd={(c) => {
            add(portionFor, c.variant, c.unitPrice, c.addons, c.picks, c.quantity);
            setPortionFor(null);
          }}
        />
      )}

      {kioskDone && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-primary-600 p-6 text-center text-white">
          <Check className="h-16 w-16" />
          <p className="text-2xl font-semibold">Thank you! Your order number is</p>
          <p className="text-8xl font-black tabular-nums">{kioskDone.number}</p>
          <p className="text-xl">Please pay {formatCurrency(kioskDone.total)} at the counter. Watch the screen for your number.</p>
          <Button variant="outline" size="lg" className="mt-4 bg-white text-primary-700" onClick={() => setKioskDone(null)}>
            Start a new order
          </Button>
        </div>
      )}

      {cartOpen && (
        <Modal
          open
          onClose={() => setCartOpen(false)}
          title={selfOrder ? "Your order" : `Your order · Table ${table?.name}`}
          description={selfOrder ? (mode === "kiosk" ? "Pay at the counter when your number is called." : "The restaurant confirms your order, then starts cooking.") : "The staff confirm your order before the kitchen starts."}
          footer={
            <>
              <Button variant="outline" onClick={() => setCartOpen(false)}>
                <X className="h-4 w-4" /> Add more
              </Button>
              <Button size="lg" loading={sending} disabled={count === 0 || (mode === "online" && online.minOrder > subtotal)} onClick={placeOrder}>
                Place order
              </Button>
            </>
          }
        >
          <ul className="divide-y divide-slate-100">
            {cart.map((l) => (
              <li key={l.key} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.name}{l.variant && <span className="font-normal text-slate-500"> ({l.variant})</span>}</span>
                  {l.addons.length > 0 && <span className="block text-sm text-slate-600">+ {addonText(l.addons)}</span>}
                  <span className="text-sm text-slate-500">{formatCurrency(l.price)} each</span>
                </span>
                <button onClick={() => change(l.key, -1)} className="rounded-lg border border-slate-200 p-1.5" aria-label={`One less ${l.name}`}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-bold">{l.quantity}</span>
                <button onClick={() => change(l.key, 1)} className="rounded-lg border border-slate-200 p-1.5" aria-label={`One more ${l.name}`}>
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between text-lg font-bold">
            <span>Items total</span>
            <span>{formatCurrency(subtotal)}</span>
          </p>
          {selfOrder && (checkout.type === "delivery" ? online.deliveryCharge > 0 || online.packingCharge > 0 : online.packingCharge > 0) && (
            <p className="text-sm text-slate-500">
              + {checkout.type === "delivery" && online.deliveryCharge > 0 ? `delivery ${formatCurrency(online.deliveryCharge)}` : ""}
              {checkout.type === "delivery" && online.deliveryCharge > 0 && online.packingCharge > 0 ? " and " : ""}
              {online.packingCharge > 0 ? `packing ${formatCurrency(online.packingCharge)}` : ""}
            </p>
          )}
          {restaurant.taxNote && <p className="text-sm text-slate-500">{restaurant.taxNote}.{selfOrder ? "" : " Your final bill comes from the staff."}</p>}
          {mode === "online" && online.minOrder > subtotal && <Tip tone="warning">The minimum order is {formatCurrency(online.minOrder)}. Add a little more.</Tip>}
          {mode === "online" && (
            <div className="mt-4 grid gap-3">
              {online.delivery && (
                <div className="grid grid-cols-2 gap-2">
                  {(["takeaway", "delivery"] as const).map((t) => (
                    <Button key={t} variant={checkout.type === t ? "primary" : "outline"} onClick={() => setCheckout({ ...checkout, type: t })}>
                      {t === "takeaway" ? <ShoppingBag className="h-4 w-4" /> : <Bike className="h-4 w-4" />} {t === "takeaway" ? "Pickup" : "Delivery"}
                    </Button>
                  ))}
                </div>
              )}
              <Field label="Phone / WhatsApp">
                <Input type="tel" value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} maxLength={20} required />
              </Field>
              {checkout.type === "delivery" && (
                <Field label="Delivery address">
                  <Textarea rows={2} value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} maxLength={300} />
                </Field>
              )}
              <Field label={checkout.type === "delivery" ? "Deliver" : "Pick up"}>
                <Select value={checkout.when} onChange={(e) => setCheckout({ ...checkout, when: e.target.value })}>
                  <option value="">As soon as possible</option>
                  {timeSlots(online.timezone).map((s) => (
                    <option key={s.value} value={s.value}>At {s.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Note for the kitchen" optional>
                <Input value={checkout.note} onChange={(e) => setCheckout({ ...checkout, note: e.target.value })} maxLength={300} placeholder="e.g. less spicy, extra chutney" />
              </Field>
            </div>
          )}
          <Field label="Your name" optional={mode !== "online"} className="mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={mode === "kiosk" ? "We call this name with your number" : "So the staff know who ordered"} />
          </Field>
          {error && <div className="mt-3"><Tip tone="danger">{error}</Tip></div>}
        </Modal>
      )}
    </div>
  );
}
