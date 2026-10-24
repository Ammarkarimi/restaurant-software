"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Check, Minus, Plus, ReceiptText, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { FoodMark } from "@/components/food-mark";
import { Button, Field, Input, Modal, Tip } from "@/components/ui";
import { api } from "@/lib/client";
import { parseVariants } from "@/lib/menu";
import { cn, formatCurrency, setCurrency } from "@/lib/utils";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  variants: string;
  foodType: string;
  available: boolean;
}

interface Line {
  key: string;
  menuItemId: string;
  name: string;
  variant: string | null;
  price: number;
  quantity: number;
}

interface Placed {
  at: string;
  orderNumber: number;
  items: Array<{ name: string; variant: string | null; quantity: number }>;
}

export function GuestMenu({
  slug,
  restaurant,
  categories,
  table,
  ordering,
}: {
  slug: string;
  restaurant: { name: string; address: string; phone: string | null; logoUrl: string | null; currency: string; taxNote: string | null };
  categories: Array<{ id: string; name: string; items: Dish[] }>;
  table: { token: string; name: string } | null;
  ordering: boolean;
}) {
  setCurrency(restaurant.currency);
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
    if (!storeKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || "[]") as Placed[];
      const since = Date.now() - 6 * 60 * 60 * 1000;
      setPlaced(saved.filter((p) => new Date(p.at).getTime() > since));
      setName(localStorage.getItem("qr-guest-name") || "");
    } catch {
      // private mode
    }
  }, [storeKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => (!vegOnly || i.foodType === "veg") && (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))) }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, vegOnly]);

  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);

  function add(dish: Dish, variant: string | null, price: number) {
    setCart((c) => {
      const same = c.find((l) => l.menuItemId === dish.id && l.variant === variant);
      if (same) return c.map((l) => (l === same ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l));
      return [...c, { key: `${dish.id}:${variant ?? ""}`, menuItemId: dish.id, name: dish.name, variant, price, quantity: 1 }];
    });
  }
  function change(key: string, delta: number) {
    setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: Math.min(20, l.quantity + delta) }])));
  }
  function pick(dish: Dish) {
    if (!dish.available) return;
    if (parseVariants(dish.variants).length) setPortionFor(dish);
    else add(dish, null, dish.price);
  }

  async function placeOrder() {
    if (!table) return;
    setSending(true);
    setError("");
    try {
      const r = await api<{ orderNumber: number; items: Placed["items"] }>(`/api/public/order/${slug}`, {
        body: { table: table.token, name: name.trim() || null, items: cart.map((l) => ({ menuItemId: l.menuItemId, variant: l.variant, quantity: l.quantity })) },
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

  async function call(type: "waiter" | "bill") {
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
                  {p.items.map((i) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(", ")}
                </li>
              ))}
            </ul>
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
                        {portions.length ? portions.map((p) => `${p.name} ${formatCurrency(p.price)}`).join(" · ") : formatCurrency(d.price)}
                      </p>
                      {d.description && <p className="mt-0.5 text-sm text-slate-500">{d.description}</p>}
                    </div>
                    {!d.available ? (
                      <span className="shrink-0 text-sm font-semibold text-red-600">Sold out</span>
                    ) : (
                      ordering && (
                        <Button size="sm" variant={inCart ? "primary" : "outline"} className="shrink-0" onClick={() => pick(d)} aria-label={`Add ${d.name}`}>
                          {inCart ? `${inCart} added` : "Add"} <Plus className="h-4 w-4" />
                        </Button>
                      )
                    )}
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
        <Modal open onClose={() => setPortionFor(null)} title={portionFor.name} description="Choose a portion" size="sm">
          <div className="grid gap-2">
            {parseVariants(portionFor.variants).map((v) => (
              <Button
                key={v.name}
                variant="outline"
                size="lg"
                className="justify-between"
                onClick={() => {
                  add(portionFor, v.name, v.price);
                  setPortionFor(null);
                }}
              >
                <span>{v.name}</span>
                <span>{formatCurrency(v.price)}</span>
              </Button>
            ))}
          </div>
        </Modal>
      )}

      {cartOpen && (
        <Modal
          open
          onClose={() => setCartOpen(false)}
          title={`Your order · Table ${table?.name}`}
          description="The staff confirm your order before the kitchen starts."
          footer={
            <>
              <Button variant="outline" onClick={() => setCartOpen(false)}>
                <X className="h-4 w-4" /> Add more
              </Button>
              <Button size="lg" loading={sending} disabled={count === 0} onClick={placeOrder}>
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
          {restaurant.taxNote && <p className="text-sm text-slate-500">{restaurant.taxNote}. Your final bill comes from the staff.</p>}
          <Field label="Your name" optional className="mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="So the staff know who ordered" />
          </Field>
          {error && <div className="mt-3"><Tip tone="danger">{error}</Tip></div>}
        </Modal>
      )}
    </div>
  );
}
