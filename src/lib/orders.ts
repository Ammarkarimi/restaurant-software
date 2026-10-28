import { Prisma } from "@prisma/client";
import { z } from "zod";
import { currentRestaurantId, prisma, type Db } from "./db";
import { fail } from "./api";
import { calculateBill, paidAmount, round2, type BillCharge, type BillRules } from "./billing";
import { addonText, addonsTotal, chooseAddons, groupsForItem, parseList } from "./menu";
import { activeLists, menuPrice } from "./pricing";
import type { SettingsRecord } from "./settings";
import { billShareToken } from "./share";

export const ACTIVE_STATUSES = ["open", "billed"];

export const orderInclude = {
  items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  payments: { orderBy: { paidAt: "asc" } },
  table: { select: { id: true, name: true, area: true } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

type Counter = "orderSeq" | "billSeq" | "kotSeq" | "purchaseSeq";

/** Hands out the next order, bill or kitchen-ticket number. Safe when two tills save at once. */
export async function nextNumber(db: Db, counter: Counter): Promise<number> {
  const r = await db.restaurant.update({
    where: { id: currentRestaurantId() },
    data: { [counter]: { increment: 1 } },
    select: { [counter]: true },
  });
  return (r as unknown as Record<Counter, number>)[counter];
}

export function rulesOf(order: Pick<FullOrder, "taxMode" | "pricesIncludeTax" | "serviceChargePercent" | "roundOff">): BillRules {
  return {
    taxMode: order.taxMode,
    pricesIncludeTax: order.pricesIncludeTax,
    serviceChargePercent: order.serviceChargePercent,
    roundOff: order.roundOff,
  };
}

export function activeItems<T extends { status: string }>(items: T[]) {
  return items.filter((i) => i.status === "active");
}

type ChargeFields = Pick<FullOrder, "packingCharge" | "deliveryCharge" | "chargeTaxRate">;

/** Packing and delivery charges of an order, as bill lines. */
export function chargesOf(order: ChargeFields): BillCharge[] {
  return [
    { name: "Packing charge", amount: order.packingCharge, taxRate: order.chargeTaxRate },
    { name: "Delivery charge", amount: order.deliveryCharge, taxRate: order.chargeTaxRate },
  ];
}

export function totalsOf(order: FullOrder) {
  return calculateBill(
    activeItems(order.items),
    rulesOf(order),
    { type: order.discountType, value: order.discountValue, max: order.discountMax },
    { charges: chargesOf(order), pointsDiscount: order.pointsRedeemed }
  );
}

export function serializeOrder(order: FullOrder) {
  const totals = totalsOf(order);
  const paid = paidAmount(order.payments);
  return {
    ...order,
    totals,
    paid,
    balance: round2(totals.total - paid),
    unsentCount: order.items.filter((i) => i.status === "active" && i.kotNumber === null).length,
    // For the "send bill on WhatsApp" link, once there is a bill to send.
    shareToken: order.billNumber ? billShareToken(order.id) : null,
  };
}

export type OrderView = ReturnType<typeof serializeOrder>;

export async function loadOrder(id: string, db: Db = prisma): Promise<FullOrder> {
  const order = await db.order.findFirst({ where: { id }, include: orderInclude });
  if (!order) fail("Order not found", 404);
  return order;
}

export function assertEditable(order: { status: string }) {
  if (order.status === "settled") fail("This bill is already paid and cannot be changed.");
  if (order.status === "cancelled") fail("This order was cancelled.");
}

/** Saves the current totals on the order, used by reports. */
export async function saveTotals(db: Db, order: FullOrder, extra: Prisma.OrderUpdateInput = {}) {
  const t = totalsOf(order);
  return db.order.update({
    where: { id: order.id },
    data: {
      subtotal: t.itemsTotal,
      discountAmount: t.discount,
      serviceCharge: t.serviceCharge,
      chargesAmount: t.chargesTotal,
      taxAmount: t.tax,
      roundOffAmount: t.roundOff,
      total: t.total,
      ...extra,
    },
    include: orderInclude,
  });
}

/** Tax rules copied onto a new order. */
export function orderRulesFrom(s: SettingsRecord) {
  return {
    taxMode: s.taxMode,
    taxName: s.taxName,
    pricesIncludeTax: s.pricesIncludeTax,
    serviceChargePercent: s.serviceChargePercent,
    roundOff: s.roundOff,
    chargeTaxRate: s.defaultTaxRate,
  };
}

/** The restaurant's usual packing and delivery charges for a new order of this type. */
export function defaultCharges(type: string, s: Pick<SettingsRecord, "packingCharge" | "deliveryCharge">) {
  return {
    packingCharge: type === "dine_in" ? 0 : s.packingCharge,
    deliveryCharge: type === "delivery" ? s.deliveryCharge : 0,
  };
}

export const newItemSchema = z
  .object({
    menuItemId: z.string().min(1).optional().nullable(),
    variant: z.string().trim().max(40).optional().nullable(),
    // Open items (not on the menu) give their own name and price.
    name: z.string().trim().max(120).optional(),
    price: z.coerce.number().min(0).max(10_000_000).optional(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(999),
    note: z.string().trim().max(200).optional().nullable(),
    // Add-ons chosen for the dish, by group and option name. Prices come from the menu.
    addons: z
      .array(z.object({ groupId: z.string().min(1).max(40), name: z.string().trim().min(1).max(60) }))
      .max(30)
      .default([]),
  })
  .refine((i) => i.menuItemId || (i.name && i.price !== undefined), "Each item needs a menu item, or a name and price");

export type NewItem = z.input<typeof newItemSchema>;

/** Where an order is taken, for special prices (area, order type, app, happy hours). */
export interface LineContext {
  area?: string | null;
  type: string;
  source: string;
  /** A guest ordering from the QR / online menu: staff-only dishes are refused. */
  guest?: boolean;
}

/**
 * Turns items from the till into order lines. Prices come from the menu (never from the browser):
 * the dish or portion price, changed by any special price list in force, plus the add-ons chosen.
 */
export async function buildLines(db: Db, items: NewItem[], settings: SettingsRecord, context: LineContext) {
  const ids = [...new Set(items.map((i) => i.menuItemId).filter((x): x is string => !!x))];
  const menu = await db.menuItem.findMany({ where: { id: { in: ids } }, include: { category: true } });
  const byId = new Map(menu.map((m) => [m.id, m]));
  const groupIds = [...new Set(menu.flatMap((m) => parseList(m.addonGroupIds)))];
  const [groups, lists] = await Promise.all([
    groupIds.length ? db.addonGroup.findMany({ where: { id: { in: groupIds } } }) : Promise.resolve([]),
    db.priceList.findMany({ where: { active: true } }),
  ]);
  const inForce = activeLists(lists, { ...context, timezone: settings.timezone });

  return items.map((i) => {
    if (!i.menuItemId) {
      return {
        menuItemId: null,
        name: i.name!,
        variant: null,
        categoryName: "Open item",
        foodType: "veg",
        price: round2(i.price!),
        quantity: i.quantity,
        taxRate: settings.defaultTaxRate,
        note: i.note || null,
        addons: "[]",
        station: null,
      };
    }
    const m = byId.get(i.menuItemId);
    if (!m) fail("An item on this order is no longer on the menu. Please remove it and add it again.");
    if (!m.available) fail(`${m.name} is marked as sold out today.`);
    if (context.guest && (!m.showOnline || !m.category.active)) fail(`${m.name} is not on the menu right now.`);
    const { price } = menuPrice(m, i.variant, inForce);
    if (price === null) fail(`Please choose a portion for ${m.name}.`);
    const chosen = chooseAddons(m.name, groupsForItem(m, groups), i.addons ?? []);
    if ("error" in chosen) fail(chosen.error);
    return {
      menuItemId: m.id,
      name: m.name,
      variant: i.variant || null,
      categoryName: m.category.name,
      foodType: m.foodType,
      price: round2(price + addonsTotal(chosen.addons)),
      quantity: i.quantity,
      taxRate: m.taxRate ?? settings.defaultTaxRate,
      note: i.note || null,
      addons: JSON.stringify(chosen.addons),
      station: m.category.station,
    };
  });
}

/** Marks every item not yet sent to the kitchen with a new kitchen ticket number. */
export async function sendUnsentToKitchen(db: Db, orderId: string): Promise<number | null> {
  const unsent = await db.orderItem.count({ where: { orderId, status: "active", kotNumber: null } });
  if (unsent === 0) return null;
  const kotNumber = await nextNumber(db, "kotSeq");
  await db.orderItem.updateMany({
    where: { orderId, status: "active", kotNumber: null },
    data: { kotNumber, sentAt: new Date() },
  });
  return kotNumber;
}

export function isUniqueViolation(error: unknown, field?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!field) return true;
  const target = (error.meta?.target ?? []) as string[] | string;
  return Array.isArray(target) ? target.some((t) => t.includes(field)) : String(target).includes(field);
}

export function itemSummary(lines: Array<{ name: string; variant: string | null; quantity: number; addons?: string }>) {
  return lines
    .map((l) => {
      const extras = addonText(l.addons);
      return `${l.quantity} × ${l.name}${l.variant ? ` (${l.variant})` : ""}${extras ? ` + ${extras}` : ""}`;
    })
    .join(", ");
}
