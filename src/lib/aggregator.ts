// Zomato / Swiggy orders through UrbanPiper. UrbanPiper sends each new order (and later status
// changes) to the restaurant's secret webhook address; the order appears on the counter with a sound,
// and Accept / Food ready / Dispatched go back to UrbanPiper, which tells Zomato / Swiggy.
// The UrbanPiper order id is kept in Order.clientId as "up:<id>", so a repeated webhook adds nothing twice.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fail } from "./api";
import { logActivity } from "./activity";
import { loadOrder, nextNumber, orderRulesFrom, saveTotals, sendUnsentToKitchen } from "./orders";
import type { SettingsRecord } from "./settings";

export interface AggregatorItem {
  name: string;
  refId: string | null;
  quantity: number;
  /** Price of one, including the options chosen. */
  price: number;
  foodType: "veg" | "non_veg" | "egg";
  note: string | null;
  addons: Array<{ group: string; name: string; price: number }>;
}

export interface AggregatorOrder {
  upOrderId: string;
  source: "zomato" | "swiggy" | "app";
  channelOrderId: string | null;
  type: "delivery" | "takeaway";
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  instructions: string | null;
  items: AggregatorItem[];
  /** Discounts the restaurant pays for (merchant promos). */
  merchantDiscount: number;
  packing: number;
  delivery: number;
  payable: number;
  prepaid: boolean;
  otp: string | null;
  scheduledFor: Date | null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isOrderRelay(body: unknown) {
  return Boolean(obj(obj(obj(body).order).details).id);
}

/** Reads UrbanPiper's "Order Relay" webhook into what the counter needs. */
export function parseUrbanPiperOrder(body: unknown): AggregatorOrder {
  const root = obj(body);
  const order = obj(root.order);
  const d = obj(order.details);
  const customer = obj(root.customer);
  const address = obj(customer.address);
  const platform = obj(arr(d.ext_platforms)[0]);
  const channel = (str(d.channel) ?? str(platform.name) ?? "").toLowerCase();
  const source = channel.includes("zomato") ? "zomato" : channel.includes("swiggy") ? "swiggy" : "app";

  const items: AggregatorItem[] = arr(order.items).map((raw) => {
    const i = obj(raw);
    const quantity = Math.max(1, Math.round(num(i.quantity)));
    const options = arr(i.options_to_add).map((o) => {
      const x = obj(o);
      return { group: str(obj(x.group).title) ?? "Option", name: str(x.title) ?? "", price: num(x.price) * Math.max(1, num(x.quantity) || 1), qty: Math.max(1, num(x.quantity) || 1) };
    });
    const optionTotal = options.reduce((s, o) => s + o.price, 0);
    // "total" is the line total when given; otherwise base price + options.
    const lineTotal = num(i.total) || (num(i.price) + optionTotal) * quantity;
    const food = String(i.food_type ?? "");
    return {
      name: (str(i.title) ?? "Item").slice(0, 120),
      refId: str(i.merchant_ref_id),
      quantity,
      price: r2(lineTotal / quantity),
      foodType: food === "2" ? "non_veg" : food === "3" ? "egg" : "veg",
      note: str(i.instructions)?.slice(0, 200) ?? null,
      addons: options.filter((o) => o.name).map((o) => ({ group: o.group, name: o.qty > 1 ? `${o.name} ×${o.qty}` : o.name, price: o.price })),
    };
  });

  let packing = 0;
  let delivery = 0;
  for (const c of arr(d.charges)) {
    const x = obj(c);
    const title = (str(x.title) ?? "").toLowerCase();
    if (title.includes("deliver")) delivery += num(x.value);
    else if (title.includes("pack")) packing += num(x.value);
  }
  for (const raw of arr(order.items)) for (const c of arr(obj(raw).charges)) if ((str(obj(c).title) ?? "").toLowerCase().includes("pack")) packing += num(obj(c).value);
  const merchantDiscount = arr(platform.discounts).length
    ? arr(platform.discounts).reduce<number>((s, x) => s + (obj(x).is_merchant_discount === false ? 0 : num(obj(x).value)), 0)
    : num(d.discount) - num(d.total_external_discount);
  const payments = arr(order.payment).map((p) => (str(obj(p).option) ?? "").toLowerCase());
  const extras = obj(platform.extras);
  const line = [str(address.line_1), str(address.line_2), str(address.sub_locality), str(address.landmark), str(address.city), str(address.pin)].filter(Boolean).join(", ");
  const when = num(d.delivery_datetime);
  return {
    upOrderId: String(d.id),
    source,
    channelOrderId: str(platform.id) ?? str(d.merchant_ref_id),
    type: (str(d.order_type) ?? "").toLowerCase().includes("pickup") ? "takeaway" : "delivery",
    customerName: str(customer.name)?.slice(0, 100) ?? null,
    customerPhone: str(customer.phone)?.slice(0, 20) ?? null,
    customerAddress: line ? line.slice(0, 300) : null,
    instructions: str(d.instructions)?.slice(0, 400) ?? null,
    items,
    merchantDiscount: r2(Math.max(0, merchantDiscount)),
    packing: r2(packing),
    delivery: r2(delivery),
    payable: r2(num(d.payable_amount) || num(d.order_total)),
    prepaid: !payments.includes("cash") && num(extras.cash_to_be_collected) === 0,
    otp: str(extras.order_otp),
    scheduledFor: when > 1e12 && extras.deliver_asap === false ? new Date(when) : null,
  };
}

/** Saves a new Zomato / Swiggy order. Returns the existing one if UrbanPiper sends it again. */
export async function createAggregatorOrder(settings: SettingsRecord, a: AggregatorOrder) {
  const clientId = `up:${a.upOrderId}`;
  const existing = await prisma.order.findFirst({ where: { clientId } });
  if (existing) return { order: existing, created: false };
  const menu = await prisma.menuItem.findMany({ select: { id: true, name: true, taxRate: true, foodType: true, category: { select: { name: true, station: true } } } });
  const byId = new Map(menu.map((m) => [m.id, m]));
  const byName = new Map(menu.map((m) => [m.name.toLowerCase(), m]));

  const order = await prisma.$transaction(async (tx) => {
    const notes = [a.channelOrderId && `${a.source === "app" ? "App" : a.source === "zomato" ? "Zomato" : "Swiggy"} order ${a.channelOrderId}`, a.otp && `OTP ${a.otp}`, a.instructions, a.prepaid ? "Paid online" : "Cash on delivery"]
      .filter(Boolean)
      .join(" · ");
    const created = await tx.order.create({
      data: {
        restaurantId: settings.restaurantId,
        number: await nextNumber(tx, "orderSeq"),
        type: a.type,
        source: a.source,
        sourceRef: a.channelOrderId?.slice(0, 40) ?? null,
        clientId,
        aggregatorStatus: "placed",
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        customerAddress: a.customerAddress,
        notes: notes.slice(0, 500) || null,
        scheduledFor: a.scheduledFor,
        createdByName: a.source === "app" ? "Online app" : a.source === "zomato" ? "Zomato" : "Swiggy",
        ...orderRulesFrom(settings),
        // GST on Zomato / Swiggy food is paid by the app (section 9(5)), so these bills carry no tax.
        ...(a.source !== "app" && { taxMode: "none" }),
        packingCharge: a.packing,
        deliveryCharge: a.delivery,
        discountType: "amount",
        discountValue: a.merchantDiscount,
        discountReason: a.merchantDiscount ? "App promo (restaurant share)" : null,
        items: {
          create: a.items.map((i) => {
            const m = (i.refId && byId.get(i.refId)) || byName.get(i.name.toLowerCase());
            return {
              restaurantId: settings.restaurantId,
              menuItemId: m?.id ?? null,
              name: m?.name ?? i.name,
              categoryName: m?.category.name ?? null,
              station: m?.category.station ?? null,
              foodType: m?.foodType ?? i.foodType,
              price: i.price,
              quantity: i.quantity,
              taxRate: m?.taxRate ?? settings.defaultTaxRate,
              note: i.note,
              addons: JSON.stringify(i.addons),
              byGuest: true,
            } satisfies Omit<Prisma.OrderItemCreateManyOrderInput, "orderId">;
          }),
        },
      },
    });
    return saveTotals(tx, await loadOrder(created.id, tx));
  });
  await logActivity({ id: null, name: order.createdByName ?? "App" }, "App order received", `Order #${order.number}${a.channelOrderId ? ` (${a.channelOrderId})` : ""}: ${a.items.length} items`);
  return { order, created: true };
}

const UP_STATUS = { acknowledged: "Acknowledged", food_ready: "Food Ready", dispatched: "Dispatched", completed: "Completed", cancelled: "Cancelled" } as const;
export type AggregatorStep = keyof typeof UP_STATUS;

/** Tells UrbanPiper (and so Zomato / Swiggy) the order's new state. */
export async function pushStatus(settings: SettingsRecord, upOrderId: string, step: AggregatorStep, extra: { message?: string; riderName?: string | null; riderPhone?: string | null } = {}) {
  // Not connected yet, or a pretend order from "Try a test order".
  if (!settings.urbanpiperUser || !settings.urbanpiperApiKey || upOrderId.startsWith("TEST")) return { pushed: false, error: null };
  const base = process.env.URBANPIPER_API_BASE || "https://pos-int.urbanpiper.com";
  try {
    const res = await fetch(`${base}/external/api/v1/orders/${encodeURIComponent(upOrderId)}/status/`, {
      method: "PUT",
      headers: { Authorization: `apikey ${settings.urbanpiperUser}:${settings.urbanpiperApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        new_status: UP_STATUS[step],
        message: extra.message ?? `Marked ${UP_STATUS[step]} at the restaurant`,
        ...(step === "dispatched" && extra.riderName && { extra: { rider_name: extra.riderName, rider_phone: extra.riderPhone ?? "" } }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { message?: string } | null;
      return { pushed: false, error: b?.message || `UrbanPiper error ${res.status}` };
    }
    return { pushed: true, error: null };
  } catch (e) {
    return { pushed: false, error: (e as Error).message };
  }
}

export function upOrderId(order: { clientId: string | null }) {
  return order.clientId?.startsWith("up:") ? order.clientId.slice(3) : null;
}

/** Accept (sends to the kitchen), food ready, dispatched — from the counter. */
export async function advanceAggregatorOrder(settings: SettingsRecord, orderId: string, step: "acknowledged" | "food_ready" | "dispatched", by: string) {
  const order = await loadOrder(orderId);
  const up = upOrderId(order);
  if (!up) fail("This order did not come through Zomato / Swiggy.");
  if (order.status === "cancelled") fail("This order is cancelled.");
  let kotNumber: number | null = null;
  await prisma.$transaction(async (tx) => {
    if (step === "acknowledged") kotNumber = await sendUnsentToKitchen(tx, orderId);
    await tx.order.update({
      where: { id: orderId },
      data: { aggregatorStatus: step, ...(step === "dispatched" && { deliveryStatus: "out", outAt: new Date() }) },
    });
  });
  const result = await pushStatus(settings, up, step, { riderName: order.riderName });
  await logActivity({ id: null, name: by }, step === "acknowledged" ? "Accepted app order" : step === "food_ready" ? "App order ready" : "App order picked up", `Order #${order.number}${result.error ? ` (UrbanPiper: ${result.error})` : ""}`);
  return { kotNumber, ...result };
}

/** A status change sent by UrbanPiper: cancelled by Zomato / the customer, picked up, delivered. */
export async function applyStatusWebhook(body: Json) {
  const id = str(body.order_id);
  const state = (str(body.new_state) ?? "").toLowerCase();
  if (!id || !state) return { handled: false };
  const order = await prisma.order.findFirst({ where: { clientId: `up:${id}` } });
  if (!order) return { handled: false };
  if (state === "cancelled" && order.status !== "cancelled" && order.status !== "settled") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "cancelled", aggregatorStatus: "cancelled", cancelReason: `Cancelled on the app${str(body.message) ? `: ${str(body.message)}` : ""}`.slice(0, 200), cancelledAt: new Date(), activeTableId: null },
    });
    await logActivity({ id: null, name: "Zomato / Swiggy" }, "App cancelled order", `Order #${order.number}${str(body.message) ? `: ${str(body.message)}` : ""}`);
  } else if (state === "dispatched") {
    await prisma.order.update({ where: { id: order.id }, data: { aggregatorStatus: "dispatched", deliveryStatus: order.deliveryStatus ?? "out", outAt: order.outAt ?? new Date() } });
  } else if (state === "completed") {
    await prisma.order.update({ where: { id: order.id }, data: { aggregatorStatus: "completed", deliveryStatus: "delivered", deliveredAt: order.deliveredAt ?? new Date() } });
  } else if (state === "customer_cancelled") {
    await logActivity({ id: null, name: "Zomato" }, "Customer asked to cancel", `Order #${order.number}${str(body.message) ? `: ${str(body.message)}` : ""}`);
  }
  return { handled: true };
}
