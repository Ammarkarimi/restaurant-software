"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  ChefHat,
  Minus,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Printer,
  ReceiptText,
  Save,
  Search,
  Split,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { Badge, Button, Loading, Modal, StatusBadge, Tip } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { FoodMark } from "@/components/food-mark";
import { BillSummary } from "@/components/pos/bill-summary";
import {
  ChargesDialog,
  CustomerDialog,
  DiscountDialog,
  MoveTableDialog,
  NoteDialog,
  OpenItemDialog,
  PaymentDialog,
  PointsDialog,
  PortionDialog,
  TransferDialog,
  type CustomerForm,
  type TransferTable,
} from "@/components/pos/pos-dialogs";
import { api, whatsappLink } from "@/lib/client";
import { normalizePhone } from "@/lib/phone";
import { calculateBill } from "@/lib/billing";
import { fromPrice, parseVariants } from "@/lib/menu";
import { cn, formatCurrency, formatTime, label } from "@/lib/utils";
import type { CategoryDTO, CustomerLookup, MenuItemDTO, OrderDTO, OrderItemDTO, SettingsDTO, TableDTO } from "@/lib/types";

/** An item added on this screen and not saved yet. */
interface CartLine {
  key: string;
  menuItemId: string | null;
  name: string;
  variant: string | null;
  price: number;
  foodType: string;
  taxRate: number;
  quantity: number;
  note: string;
}

type Dialog =
  | { kind: "portion"; item: MenuItemDTO }
  | { kind: "open" }
  | { kind: "note"; target: { cartKey: string } | { itemId: string }; initial: string; title: string }
  | { kind: "customer" }
  | { kind: "discount" }
  | { kind: "charges" }
  | { kind: "points" }
  | { kind: "move"; tables: TableDTO[] }
  | { kind: "transfer"; tables: TransferTable[] }
  | { kind: "pay" }
  | { kind: "more" }
  | null;

const AUTO_KOT_KEY = "pos:auto-print-kot";

function readAutoPrint() {
  try {
    return localStorage.getItem(AUTO_KOT_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Opens the print window straight away (inside the click) so pop-up blockers allow it. */
function openPrintWindow() {
  return window.open("about:blank", "_blank", "width=480,height=760");
}

export function PosScreen({ orderId, newOrder }: { orderId?: string; newOrder?: { type: string; tableId: string | null } }) {
  const router = useRouter();
  const { toast, confirm, isAdmin, settings: shell } = useApp();
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [table, setTable] = useState<TableDTO | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState<"menu" | "order">("menu");
  const [autoKot, setAutoKot] = useState(true);
  const [draftCustomer, setDraftCustomer] = useState<CustomerForm>({ customerName: "", customerPhone: "", customerAddress: "", guests: "", notes: "", source: "counter", sourceRef: "" });
  const [known, setKnown] = useState<CustomerLookup | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const keySeq = useRef(1);

  useEffect(() => setAutoKot(readAutoPrint()), []);

  useEffect(() => {
    Promise.all([
      api<{ categories: CategoryDTO[] }>("/api/menu"),
      api<{ settings: SettingsDTO }>("/api/settings"),
      orderId ? api<{ order: OrderDTO }>(`/api/orders/${orderId}`) : Promise.resolve(null),
      newOrder?.tableId ? api<{ tables: TableDTO[] }>("/api/tables") : Promise.resolve(null),
    ]).then(
      ([m, s, o, t]) => {
        setCategories(m.categories.filter((c) => c.active));
        setSettings(s.settings);
        if (o) setOrder(o.order);
        if (t) setTable(t.tables.find((x) => x.id === newOrder?.tableId) ?? null);
      },
      (e) => setError(e.message)
    );
  }, [orderId, newOrder?.tableId]);

  const editable = !order || order.status === "open" || order.status === "billed";

  // A guest we know by phone: show their visits and loyalty points.
  const phone = normalizePhone(order ? order.customerPhone : draftCustomer.customerPhone);
  useEffect(() => {
    if (!phone) {
      setKnown(null);
      return;
    }
    api<{ customers: CustomerLookup[] }>(`/api/customers?q=${phone}`).then(
      (r) => setKnown(r.customers.find((c) => c.phone === phone) ?? null),
      () => setKnown(null)
    );
  }, [phone, order?.status]);
  const orderType = order?.type ?? newOrder?.type ?? "dine_in";
  const tableName = order?.table?.name ?? table?.name;

  // ---------- menu ----------
  const allItems = useMemo(() => (categories ?? []).flatMap((c) => c.items), [categories]);
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return allItems
        .filter((i) => i.name.toLowerCase().includes(q) || i.shortCode?.toLowerCase().startsWith(q))
        .sort((a, b) => Number(b.shortCode?.toLowerCase() === q) - Number(a.shortCode?.toLowerCase() === q));
    }
    if (category === "all") return allItems;
    return categories?.find((c) => c.id === category)?.items ?? [];
  }, [allItems, categories, category, query]);

  const taxFor = useCallback((item: { taxRate: number | null }) => item.taxRate ?? settings?.defaultTaxRate ?? 0, [settings]);

  function addToCart(line: Omit<CartLine, "key" | "quantity" | "note">, quantity = 1) {
    setCart((c) => {
      const same = c.find((l) => l.menuItemId && l.menuItemId === line.menuItemId && l.variant === line.variant && !l.note);
      if (same) return c.map((l) => (l === same ? { ...l, quantity: l.quantity + quantity } : l));
      return [...c, { ...line, key: `c${keySeq.current++}`, quantity, note: "" }];
    });
  }

  function pickItem(item: MenuItemDTO) {
    if (!editable) return;
    if (!item.available) {
      toast(`${item.name} is sold out today`, "info");
      return;
    }
    if (parseVariants(item.variants).length > 0) {
      setDialog({ kind: "portion", item });
      return;
    }
    addToCart({ menuItemId: item.id, name: item.name, variant: null, price: item.price, foodType: item.foodType, taxRate: taxFor(item) });
  }

  // ---------- totals ----------
  const rules = order
    ? { taxMode: order.taxMode, pricesIncludeTax: order.pricesIncludeTax, serviceChargePercent: order.serviceChargePercent, roundOff: order.roundOff }
    : settings
      ? { taxMode: settings.taxMode, pricesIncludeTax: settings.pricesIncludeTax, serviceChargePercent: settings.serviceChargePercent, roundOff: settings.roundOff }
      : null;
  const activeItems = useMemo(() => (order?.items ?? []).filter((i) => i.status === "active"), [order]);
  // Packing / delivery charges: the order's own, or the restaurant's usual ones for a new order.
  const charges = order
    ? { packingCharge: order.packingCharge, deliveryCharge: order.deliveryCharge, taxRate: order.chargeTaxRate }
    : settings
      ? {
          packingCharge: orderType === "dine_in" ? 0 : settings.packingCharge,
          deliveryCharge: orderType === "delivery" ? settings.deliveryCharge : 0,
          taxRate: settings.defaultTaxRate,
        }
      : null;
  const totals = useMemo(() => {
    if (!rules || !charges) return null;
    return calculateBill([...activeItems, ...cart], rules, order ? { type: order.discountType, value: order.discountValue } : null, {
      charges: [
        { name: "Packing charge", amount: charges.packingCharge, taxRate: charges.taxRate },
        { name: "Delivery charge", amount: charges.deliveryCharge, taxRate: charges.taxRate },
      ],
      pointsDiscount: order?.pointsRedeemed ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, cart, order, rules?.taxMode, rules?.pricesIncludeTax, rules?.serviceChargePercent, rules?.roundOff, charges?.packingCharge, charges?.deliveryCharge, charges?.taxRate]);

  const sentItems = activeItems.filter((i) => i.kotNumber !== null);
  const readyItems = sentItems.filter((i) => i.kitchenStatus === "ready");
  const unsentItems = activeItems.filter((i) => i.kotNumber === null);
  const cancelledItems = (order?.items ?? []).filter((i) => i.status === "cancelled");
  const newCount = unsentItems.length + cart.length;

  // ---------- saving ----------
  const cartPayload = () =>
    cart.map((l) =>
      l.menuItemId
        ? { menuItemId: l.menuItemId, variant: l.variant, quantity: l.quantity, note: l.note || null }
        : { name: l.name, price: l.price, quantity: l.quantity, note: l.note || null }
    );

  /** Saves the cart (creating the order the first time). Returns the saved order. */
  async function saveCart(sendToKitchen: boolean): Promise<{ order: OrderDTO; kotNumber: number | null }> {
    if (!order) {
      const r = await api<{ order: OrderDTO; kotNumber: number | null }>("/api/orders", {
        body: {
          type: newOrder?.type ?? "dine_in",
          source: draftCustomer.source,
          sourceRef: draftCustomer.sourceRef || null,
          tableId: newOrder?.tableId ?? null,
          customerName: draftCustomer.customerName || null,
          customerPhone: draftCustomer.customerPhone || null,
          customerAddress: draftCustomer.customerAddress || null,
          guests: Number(draftCustomer.guests) || 0,
          notes: draftCustomer.notes || null,
          items: cartPayload(),
          sendToKitchen,
        },
      });
      setCart([]);
      setOrder(r.order);
      return r;
    }
    if (cart.length) {
      const r = await api<{ order: OrderDTO; kotNumber: number | null }>(`/api/orders/${order.id}/items`, { body: { items: cartPayload(), sendToKitchen } });
      setCart([]);
      setOrder(r.order);
      return r;
    }
    if (sendToKitchen && order.unsentCount > 0) {
      const r = await api<{ order: OrderDTO; kotNumber: number | null }>(`/api/orders/${order.id}/kot`, { method: "POST" });
      setOrder(r.order);
      return r;
    }
    return { order, kotNumber: null };
  }

  async function run<T>(name: string, fn: () => Promise<T>, win?: Window | null): Promise<T | undefined> {
    setBusy(name);
    try {
      return await fn();
    } catch (e) {
      win?.close();
      toast((e as Error).message, "error");
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  /**
   * After the first save of a new order, move the address bar to the saved order so a
   * refresh shows it. Done only when nothing else is open, because it reloads the screen.
   */
  function showSavedOrder(id: string) {
    if (!orderId) router.replace(`/orders/${id}`);
  }

  function showPrint(win: Window | null, url: string) {
    if (win && !win.closed) win.location.href = url;
    else window.open(url, "_blank");
  }

  async function sendToKitchen() {
    if (newCount === 0) return toast("Add items first", "info");
    const win = autoKot ? openPrintWindow() : null;
    const r = await run("kot", () => saveCart(true), win);
    if (!r) return;
    if (r.kotNumber) {
      toast(`Sent to kitchen · KOT ${r.kotNumber}`);
      if (autoKot) showPrint(win, `/print/kot/${r.order.id}?kot=${r.kotNumber}&auto=1`);
    } else win?.close();
    if (orderType === "dine_in") router.push("/");
    else showSavedOrder(r.order.id);
  }

  async function saveOnly() {
    if (cart.length === 0) return;
    const r = await run("save", () => saveCart(false));
    if (!r) return;
    toast("Order saved. Send it to the kitchen when ready.");
    showSavedOrder(r.order.id);
  }

  async function printBill() {
    if (activeItems.length + cart.length === 0) return toast("Add items first", "info");
    const win = openPrintWindow();
    const r = await run(
      "bill",
      async () => {
        const saved = await saveCart(false);
        return api<{ order: OrderDTO; kotNumber: number | null }>(`/api/orders/${saved.order.id}/bill`, { method: "POST" });
      },
      win
    );
    if (!r) return;
    setOrder(r.order);
    showPrint(win, `/print/bill/${r.order.id}?auto=1`);
    if (r.kotNumber) toast(`New items were sent to the kitchen as KOT ${r.kotNumber}`, "info");
    showSavedOrder(r.order.id);
  }

  async function openPayment() {
    if (activeItems.length + cart.length === 0) return toast("Add items first", "info");
    if (cart.length || !order) {
      const r = await run("pay", () => saveCart(false));
      if (!r) return;
    }
    setDialog({ kind: "pay" });
  }

  async function settle(payments: Array<{ method: string; amount: number; reference: string | null }>) {
    if (!order) return;
    const r = await api<{ order: OrderDTO; kotNumber: number | null }>(`/api/orders/${order.id}/settle`, { body: { payments } });
    setOrder(r.order);
    setDialog(null);
    toast(`Paid · Bill ${r.order.billNumber}${tableName ? ` · ${tableName} is free now` : ""}`);
    showSavedOrder(r.order.id);
  }

  async function markServed() {
    if (!order) return;
    await run("served", async () => {
      await api("/api/kitchen", { method: "PATCH", body: { itemIds: readyItems.map((i) => i.id), status: "served" } });
      const r = await api<{ order: OrderDTO }>(`/api/orders/${order.id}`);
      setOrder(r.order);
    });
  }

  async function patchOrder(body: Record<string, unknown>, message?: string) {
    if (!order) return;
    const r = await api<{ order: OrderDTO }>(`/api/orders/${order.id}`, { method: "PATCH", body });
    setOrder(r.order);
    if (message) toast(message);
  }

  // ---------- item changes ----------
  function changeCart(key: string, delta: number) {
    setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }])));
  }

  async function changeSaved(item: OrderItemDTO, quantity: number) {
    if (!order) return;
    let reason: string | undefined;
    if (item.kotNumber !== null) {
      const ok = await confirm({
        title: quantity === 0 ? `Remove ${item.name}?` : `Reduce ${item.name} to ${quantity}?`,
        message: "The kitchen already has this item. Tell them it is cancelled. The owner can see this in the activity history.",
        askReason: "Reason",
        confirmText: "Remove",
        danger: true,
      });
      if (!ok) return;
      if (!ok.reason.trim()) return toast("Please give a reason", "error");
      reason = ok.reason.trim();
    }
    await run(`item-${item.id}`, async () => {
      const r = await api<{ order: OrderDTO }>(`/api/orders/${order.id}/items/${item.id}`, { method: "PATCH", body: { quantity, reason } });
      setOrder(r.order);
    });
  }

  async function saveNote(note: string) {
    if (dialog?.kind !== "note") return;
    const target = dialog.target;
    if ("cartKey" in target) {
      setCart((c) => c.map((l) => (l.key === target.cartKey ? { ...l, note } : l)));
    } else if (order) {
      await run("note", async () => {
        const r = await api<{ order: OrderDTO }>(`/api/orders/${order.id}/items/${target.itemId}`, { method: "PATCH", body: { note } });
        setOrder(r.order);
      });
    }
    setDialog(null);
  }

  async function cancelOrder() {
    setDialog(null);
    if (!order) {
      setCart([]);
      router.push("/");
      return;
    }
    const ok = await confirm({
      title: order.status === "settled" ? `Cancel paid bill ${order.billNumber}?` : `Cancel order #${order.number}?`,
      message:
        order.status === "settled"
          ? "The sale is removed from reports. Return the money to the customer yourself. This is recorded in the activity history."
          : "The table becomes free and the order is kept as cancelled in Bills.",
      askReason: "Reason for cancelling",
      confirmText: "Cancel order",
      cancelText: "Keep order",
      danger: true,
    });
    if (!ok) return;
    if (ok.reason.trim().length < 2) return toast("Please give a reason for cancelling", "error");
    const r = await run("cancel", () => api<{ order: OrderDTO }>(`/api/orders/${order.id}/cancel`, { body: { reason: ok.reason.trim() } }));
    if (r) {
      setOrder(r.order);
      toast("Order cancelled");
    }
  }

  async function openMove() {
    setDialog(null);
    const r = await run("move", () => api<{ tables: Array<TableDTO & { order: unknown }> }>("/api/pos"));
    if (r) setDialog({ kind: "move", tables: r.tables.filter((t) => !t.order) });
  }

  function billMessage(o: OrderDTO) {
    const lines = [`Thank you for visiting ${settings!.restaurantName}!`, `Bill ${o.billNumber}: ${formatCurrency(o.totals.total)}`];
    if (o.pointsEarned > 0) lines.push(`You earned ${o.pointsEarned} loyalty points${known ? ` (balance ${known.points})` : ""}.`);
    lines.push(`Your bill: ${window.location.origin}/b/${o.shareToken}`);
    return lines.join("\n");
  }

  async function openTransfer() {
    setDialog(null);
    if (cart.length) return toast("Save the new items first (Send to kitchen or Save), then move them", "info");
    const r = await run("transfer", () => api<{ tables: TransferTable[] }>("/api/pos"));
    if (r) setDialog({ kind: "transfer", tables: r.tables });
  }

  async function transfer(body: { items: Array<{ itemId: string; quantity: number }>; to: { tableId: string } | { newBill: true } }) {
    if (!order) return;
    try {
      const r = await api<{ order: OrderDTO | null; target: OrderDTO }>(`/api/orders/${order.id}/transfer`, { body });
      setDialog(null);
      const where = r.target.table && "tableId" in body.to ? `table ${r.target.table.name}` : `separate bill #${r.target.number}`;
      if (!r.order) {
        toast(`Moved to ${where}`);
        if (r.target.id === order.id) setOrder(r.target);
        else router.replace(`/orders/${r.target.id}`);
      } else if ("newBill" in body.to) {
        toast(`Separate bill #${r.target.number} made. Take its payment now.`);
        router.push(`/orders/${r.target.id}`);
      } else {
        setOrder(r.order);
        toast(`Moved to ${where}`);
      }
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  }

  // Keyboard: "/" focuses search, Enter adds the first match.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <Tip tone="danger">{error}</Tip>;
  if (!categories || !settings || !totals || (orderId && !order)) return <Loading />;

  const title = orderType === "dine_in" ? `Table ${tableName ?? "?"}` : label(orderType);
  const source = order ? order.source : draftCustomer.source;
  const sourceRef = order ? order.sourceRef : draftCustomer.sourceRef;
  const fromApp = ["zomato", "swiggy", "app"].includes(source);
  const discountLabel = order && order.discountValue > 0 ? (order.discountType === "percent" ? `${order.discountValue}%` : undefined) : undefined;
  const customer = order ? order.customerName || order.customerPhone : draftCustomer.customerName || draftCustomer.customerPhone;
  const guests = order ? order.guests : Number(draftCustomer.guests) || 0;

  // ---------- render ----------
  const menuPanel = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visibleItems[0]) {
              pickItem(visibleItems[0]);
              setQuery("");
            }
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search dish or short code  ( / )"
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[15px] outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          aria-label="Search the menu"
        />
      </div>
      {!query && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                category === c.id ? "bg-primary-600 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {allItems.length === 0 ? (
        <Tip>
          Your menu is empty. {isAdmin ? <Link href="/menu" className="font-semibold underline">Add dishes in Menu</Link> : "Ask the owner to add dishes."} — or use “Open item” below.
        </Tip>
      ) : visibleItems.length === 0 ? (
        <p className="py-8 text-center text-slate-500">No dish matches “{query}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item) => {
            const inCart = cart.filter((l) => l.menuItemId === item.id).reduce((s, l) => s + l.quantity, 0);
            const hasPortions = parseVariants(item.variants).length > 0;
            return (
              <button
                key={item.id}
                onClick={() => pickItem(item)}
                disabled={!editable}
                className={cn(
                  "relative flex min-h-20 flex-col justify-between rounded-xl border bg-white p-2.5 text-left shadow-sm transition active:scale-[0.98]",
                  item.available ? "border-slate-200 hover:border-primary-300" : "border-dashed border-slate-200 opacity-50",
                  !editable && "cursor-not-allowed"
                )}
              >
                {inCart > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white">{inCart}</span>}
                <span className="flex items-start gap-1.5 pr-5">
                  <FoodMark type={item.foodType} className="mt-1" />
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.name}</span>
                </span>
                <span className="mt-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">
                    {hasPortions && <span className="font-normal text-slate-400">from </span>}
                    {formatCurrency(fromPrice(item))}
                  </span>
                  {!item.available ? <span className="text-xs font-semibold text-red-600">Sold out</span> : item.shortCode && <span className="text-xs text-slate-400">{item.shortCode}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {editable && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "open" })}>
            <Plus className="h-4 w-4" /> Open item (not on menu)
          </Button>
        </div>
      )}
    </div>
  );

  const lineRow = (
    key: string,
    l: { name: string; variant: string | null; foodType: string; price: number; quantity: number; note: string | null },
    opts: { onMinus?: () => void; onPlus?: () => void; onNote?: () => void; tag?: React.ReactNode; muted?: boolean; busyKey?: string }
  ) => (
    <li key={key} className={cn("flex items-start gap-2 py-2", opts.muted && "opacity-50")}>
      <FoodMark type={l.foodType} className="mt-1" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] font-semibold leading-snug text-slate-900", opts.muted && "line-through")}>
          {l.name}
          {l.variant && <span className="font-normal text-slate-500"> ({l.variant})</span>}
        </p>
        <p className="text-xs text-slate-500">
          {formatCurrency(l.price)} each {opts.tag}
        </p>
        {l.note && <p className="text-xs font-medium text-amber-700">“{l.note}”</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[15px] font-semibold">{formatCurrency(l.price * l.quantity)}</span>
        {opts.onMinus ? (
          <div className="flex items-center gap-1">
            {opts.onNote && (
              <button onClick={opts.onNote} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Add a note for the kitchen">
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button onClick={opts.onMinus} disabled={busy === opts.busyKey} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="One less">
              {l.quantity === 1 ? <Trash2 className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4" />}
            </button>
            <span className="w-7 text-center font-bold">{l.quantity}</span>
            {opts.onPlus ? (
              <button onClick={opts.onPlus} disabled={busy === opts.busyKey} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50" aria-label="One more">
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-[30px]" />
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-500">× {l.quantity}</span>
        )}
      </div>
    </li>
  );

  const orderPanel = (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-10.5rem)]">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
            {title}
            {order && <span className="text-sm font-medium text-slate-500">#{order.number}</span>}
            {order && <StatusBadge status={order.status} />}
            {source !== "counter" && (
              <Badge variant={fromApp ? "purple" : "info"}>
                {label(source)}
                {sourceRef ? ` #${sourceRef}` : ""}
              </Badge>
            )}
          </p>
          <button onClick={() => setDialog({ kind: "customer" })} disabled={!editable} className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700">
            <User className="h-3.5 w-3.5" />
            {customer || "Add customer"}
            {guests > 0 ? ` · ${guests} guest${guests === 1 ? "" : "s"}` : ""}
            {known && (
              <span className="text-emerald-700">
                {" "}· {known.visits} visit{known.visits === 1 ? "" : "s"}
                {settings.loyaltyEnabled && ` · ${known.points} pts`}
              </span>
            )}
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "more" })} aria-label="More actions">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {activeItems.length + cart.length === 0 && cancelledItems.length === 0 && (
          <p className="py-10 text-center text-slate-500">Tap dishes on the menu to add them.</p>
        )}
        {(unsentItems.length > 0 || cart.length > 0) && (
          <>
            <p className="pt-3 text-xs font-bold uppercase tracking-wide text-red-600">New — not sent to kitchen</p>
            <ul className="divide-y divide-slate-100">
              {unsentItems.map((i) =>
                lineRow(i.id, i, {
                  tag: i.byGuest ? <b className="text-violet-700">· ordered by guest (QR)</b> : undefined,
                  onMinus: editable ? () => changeSaved(i, i.quantity - 1) : undefined,
                  onPlus: editable ? () => changeSaved(i, i.quantity + 1) : undefined,
                  onNote: editable ? () => setDialog({ kind: "note", target: { itemId: i.id }, initial: i.note ?? "", title: `Note for ${i.name}` }) : undefined,
                  busyKey: `item-${i.id}`,
                })
              )}
              {cart.map((l) =>
                lineRow(l.key, l, {
                  onMinus: () => changeCart(l.key, -1),
                  onPlus: () => changeCart(l.key, 1),
                  onNote: () => setDialog({ kind: "note", target: { cartKey: l.key }, initial: l.note, title: `Note for ${l.name}` }),
                })
              )}
            </ul>
          </>
        )}
        {readyItems.length > 0 && editable && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <span>
              {readyItems.length} dish{readyItems.length === 1 ? " is" : "es are"} ready in the kitchen
            </span>
            <Button size="sm" variant="success" loading={busy === "served"} onClick={markServed}>
              Served
            </Button>
          </div>
        )}
        {sentItems.length > 0 && (
          <>
            <p className="pt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Sent to kitchen</p>
            <ul className="divide-y divide-slate-100">
              {sentItems.map((i) =>
                lineRow(i.id, i, {
                  onMinus: editable ? () => changeSaved(i, i.quantity - 1) : undefined,
                  tag: (
                    <span className="text-slate-400">
                      · KOT {i.kotNumber}
                      {i.sentAt ? ` at ${formatTime(i.sentAt, shell.timezone)}` : ""}
                      {i.kitchenStatus === "ready" && <b className="text-emerald-600"> · Ready</b>}
                      {i.kitchenStatus === "served" && <span> · Served</span>}
                    </span>
                  ),
                  busyKey: `item-${i.id}`,
                })
              )}
            </ul>
          </>
        )}
        {cancelledItems.length > 0 && (
          <details className="py-2 text-sm">
            <summary className="cursor-pointer text-slate-500">{cancelledItems.length} removed item(s)</summary>
            <ul>
              {cancelledItems.map((i) => (
                <li key={i.id} className="py-1 text-slate-500">
                  <span className="line-through">{i.quantity} × {i.name}{i.variant ? ` (${i.variant})` : ""}</span>
                  {i.cancelReason && <span> — {i.cancelReason}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <BillSummary
          totals={totals}
          taxMode={rules!.taxMode}
          taxName={order?.taxName ?? settings.taxName}
          pricesIncludeTax={rules!.pricesIncludeTax}
          serviceChargePercent={rules!.serviceChargePercent}
          discountLabel={discountLabel}
          pointsAction={
            editable && order && settings.loyaltyEnabled && known && (known.points >= settings.loyaltyMinRedeem || order.pointsRedeemed > 0)
              ? { label: `Use loyalty points (${known.points})`, onClick: () => setDialog({ kind: "points" }) }
              : undefined
          }
          onChargesClick={
            editable && orderType !== "dine_in"
              ? () => {
                  if (!order) return toast("Save or send the order first, then change the charges", "info");
                  setDialog({ kind: "charges" });
                }
              : undefined
          }
          onDiscountClick={
            editable
              ? () => {
                  if (!order) return toast("Save or send the order first, then add a discount", "info");
                  setDialog({ kind: "discount" });
                }
              : undefined
          }
        />
        {order?.status === "settled" && (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Paid {order.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount)}`).join(" + ") || "(nothing to pay)"}
            {order.billNumber && <> · Bill <b>{order.billNumber}</b></>}
          </div>
        )}
        {order?.status === "cancelled" && (
          <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Cancelled: {order.cancelReason}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
        {editable ? (
          <>
            <Button variant="warning" size="lg" className="col-span-2" loading={busy === "kot"} disabled={!!busy || newCount === 0} onClick={sendToKitchen}>
              <ChefHat className="h-5 w-5" /> Send to kitchen{newCount ? ` (${newCount})` : ""}
            </Button>
            <Button variant="outline" size="lg" className="whitespace-nowrap px-3 text-base" loading={busy === "bill"} disabled={!!busy} onClick={printBill}>
              <ReceiptText className="h-5 w-5" /> {order?.billNumber ? "Reprint bill" : "Print bill"}
            </Button>
            <Button variant="success" size="lg" className="whitespace-nowrap px-3 text-base" loading={busy === "pay"} disabled={!!busy} onClick={openPayment}>
              <Wallet className="h-5 w-5" /> Take payment
            </Button>
            {cart.length > 0 && orderType !== "takeaway" && (
              <Button variant="ghost" size="sm" className="col-span-2" loading={busy === "save"} disabled={!!busy} onClick={saveOnly}>
                <Save className="h-4 w-4" /> Save without sending to kitchen
              </Button>
            )}
          </>
        ) : (
          <>
            {order?.status === "settled" && (
              <>
                <a href={`/print/bill/${order.id}?auto=1`} target="_blank" rel="noopener noreferrer" className="col-span-1">
                  <Button variant="outline" size="lg" className="w-full">
                    <Printer className="h-5 w-5" /> Print bill
                  </Button>
                </a>
                {order.shareToken && (
                  <a href={whatsappLink(order.customerPhone, billMessage(order))} target="_blank" rel="noopener noreferrer" className="col-span-1">
                    <Button variant="outline" size="lg" className="w-full whitespace-nowrap px-3 text-base text-emerald-700">
                      <MessageCircle className="h-5 w-5" /> WhatsApp bill
                    </Button>
                  </a>
                )}
              </>
            )}
            <Link href="/" className={order?.status === "settled" && !order.shareToken ? "" : "col-span-2"}>
              <Button size="lg" className="w-full">
                <ArrowLeft className="h-5 w-5" /> Back to tables
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="pb-20 lg:pb-0">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Tables
        </Link>
        <h1 className="text-xl font-bold text-slate-900 lg:hidden">{title}</h1>
        {order?.status === "billed" && <Badge variant="info" className="ml-auto">Bill printed — waiting for payment</Badge>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className={cn("min-w-0", mobileTab === "order" && "hidden lg:block")}>{menuPanel}</div>
        <div className={cn("min-w-0", mobileTab === "menu" && "hidden lg:block")}>{orderPanel}</div>
      </div>

      {/* Phone: switch between the menu and the order. */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white p-2 lg:hidden">
        <Button variant={mobileTab === "menu" ? "primary" : "outline"} onClick={() => setMobileTab("menu")}>
          Menu
        </Button>
        <Button variant={mobileTab === "order" ? "primary" : "outline"} onClick={() => setMobileTab("order")}>
          Order · {formatCurrency(totals.total)}
          {newCount > 0 && <span className="rounded-full bg-red-600 px-1.5 text-xs text-white">{newCount}</span>}
        </Button>
      </div>

      {dialog?.kind === "portion" && (
        <PortionDialog
          item={dialog.item}
          onClose={() => setDialog(null)}
          onPick={(variant, price) => {
            const it = dialog.item;
            addToCart({ menuItemId: it.id, name: it.name, variant, price, foodType: it.foodType, taxRate: taxFor(it) });
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "open" && (
        <OpenItemDialog
          onClose={() => setDialog(null)}
          onAdd={(name, price, quantity) => {
            addToCart({ menuItemId: null, name, variant: null, price, foodType: "veg", taxRate: settings.defaultTaxRate }, quantity);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "note" && <NoteDialog initial={dialog.initial} title={dialog.title} onClose={() => setDialog(null)} onSave={saveNote} />}
      {dialog?.kind === "customer" && (
        <CustomerDialog
          isDelivery={orderType === "delivery"}
          showSource={orderType !== "dine_in"}
          initial={
            order
              ? {
                  customerName: order.customerName ?? "",
                  customerPhone: order.customerPhone ?? "",
                  customerAddress: order.customerAddress ?? "",
                  guests: order.guests ? String(order.guests) : "",
                  notes: order.notes ?? "",
                  source: order.source,
                  sourceRef: order.sourceRef ?? "",
                }
              : draftCustomer
          }
          onClose={() => setDialog(null)}
          onSave={async (f) => {
            if (!order) {
              setDraftCustomer(f);
              setDialog(null);
              return;
            }
            try {
              await patchOrder(
                {
                  customerName: f.customerName || null,
                  customerPhone: f.customerPhone || null,
                  customerAddress: f.customerAddress || null,
                  guests: Number(f.guests) || 0,
                  notes: f.notes || null,
                  ...(orderType !== "dine_in" && { source: f.source, sourceRef: f.sourceRef || null }),
                },
                "Saved"
              );
              setDialog(null);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        />
      )}
      {dialog?.kind === "discount" && order && (
        <DiscountDialog
          initial={{ type: order.discountType, value: order.discountValue, reason: order.discountReason ?? "" }}
          itemsTotal={totals.itemsTotal}
          onClose={() => setDialog(null)}
          onSave={async (d) => {
            try {
              await patchOrder({ discountType: d.type, discountValue: d.value, discountReason: d.reason || null }, d.value ? "Discount applied" : "Discount removed");
              setDialog(null);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        />
      )}
      {dialog?.kind === "points" && order && known && (
        <PointsDialog
          balance={known.points}
          minRedeem={settings.loyaltyMinRedeem}
          maxUsable={totals.itemsTotal - (totals.discount - totals.pointsDiscount)}
          initial={order.pointsRedeemed}
          onClose={() => setDialog(null)}
          onSave={async (points) => {
            try {
              await patchOrder({ pointsRedeemed: points }, points ? `${points} points used` : "Points removed");
              setDialog(null);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        />
      )}
      {dialog?.kind === "charges" && order && (
        <ChargesDialog
          initial={{ packingCharge: order.packingCharge, deliveryCharge: order.deliveryCharge }}
          isDelivery={orderType === "delivery"}
          onClose={() => setDialog(null)}
          onSave={async (c) => {
            try {
              await patchOrder(c, "Charges saved");
              setDialog(null);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        />
      )}
      {dialog?.kind === "move" && (
        <MoveTableDialog
          tables={dialog.tables}
          current={order?.tableId ?? null}
          onClose={() => setDialog(null)}
          onMove={async (tableId) => {
            try {
              await patchOrder({ tableId }, "Order moved");
              setDialog(null);
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        />
      )}
      {dialog?.kind === "transfer" && order && (
        <TransferDialog items={activeItems} tables={dialog.tables} currentTableId={order.activeTableId} onClose={() => setDialog(null)} onTransfer={transfer} />
      )}
      {dialog?.kind === "pay" && order && (
        <PaymentDialog
          total={order.totals.total}
          upiId={settings.upiId}
          payeeName={settings.restaurantName}
          currency={settings.currency}
          initialMethod={fromApp ? "online" : "cash"}
          billLabel={`${title} · Order #${order.number}${order.billNumber ? ` · Bill ${order.billNumber}` : ""}`}
          onClose={() => setDialog(null)}
          onPay={settle}
        />
      )}
      {dialog?.kind === "more" && (
        <Modal open onClose={() => setDialog(null)} title="More actions" size="sm">
          <div className="grid gap-2">
            {editable && (
              <Button variant="outline" className="justify-start" onClick={() => setDialog({ kind: "customer" })}>
                <User className="h-4 w-4" /> Customer & guests
              </Button>
            )}
            {editable && order && (
              <Button variant="outline" className="justify-start" onClick={openMove}>
                <ArrowRightLeft className="h-4 w-4" /> {orderType === "dine_in" ? "Move to another table" : "Seat at a table"}
              </Button>
            )}
            {editable && order && activeItems.length > 0 && (
              <Button variant="outline" className="justify-start" onClick={openTransfer}>
                <Split className="h-4 w-4" /> Split bill / move items to another table
              </Button>
            )}
            {order && sentItems.length > 0 && (
              <a href={`/print/kot/${order.id}?auto=1`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <Printer className="h-4 w-4" /> Print all kitchen tickets again
                </Button>
              </a>
            )}
            {order?.billNumber && (
              <a href={`/print/bill/${order.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <ReceiptText className="h-4 w-4" /> View bill
                </Button>
              </a>
            )}
            {order?.shareToken && order.status !== "cancelled" && (
              <a href={whatsappLink(order.customerPhone, billMessage(order))} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full justify-start">
                  <MessageCircle className="h-4 w-4" /> Send bill on WhatsApp
                </Button>
              </a>
            )}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-[15px]">
              <input
                type="checkbox"
                checked={autoKot}
                onChange={(e) => {
                  setAutoKot(e.target.checked);
                  try {
                    localStorage.setItem(AUTO_KOT_KEY, e.target.checked ? "on" : "off");
                  } catch {
                    // private mode: the choice lasts until the page closes
                  }
                }}
                className="h-4 w-4 accent-primary-600"
              />
              Print kitchen ticket when sending (this device)
            </label>
            {(editable || (order?.status === "settled" && isAdmin)) && (
              <Button variant="outline" className="justify-start text-red-700" onClick={cancelOrder}>
                <Ban className="h-4 w-4" /> {!order ? "Discard this order" : order.status === "settled" ? "Cancel this paid bill" : "Cancel order"}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
