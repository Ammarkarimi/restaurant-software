import type { Db } from "./db";
import { round2 } from "./billing";
import type { FullOrder } from "./orders";

export const STOCK_UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "pack", "box", "bottle"] as const;
export const STOCK_ENTRY_TYPES = ["purchase", "used", "returned", "wastage", "count"] as const;

/** Stock amounts keep three decimals (e.g. 0.125 kg). */
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

interface EntryInput {
  stockItemId: string;
  type: (typeof STOCK_ENTRY_TYPES)[number];
  /** + adds stock, − takes it out. */
  quantity: number;
  date: string;
  createdByName: string;
  cost?: number | null;
  supplier?: string | null;
  note?: string | null;
  orderId?: string | null;
}

/** Changes the stock of one item and records why. Safe when two tills pay bills at once. */
export async function addStockEntry(tx: Db, e: EntryInput) {
  const item = await tx.stockItem.update({ where: { id: e.stockItemId }, data: { quantity: { increment: round3(e.quantity) } } });
  const balance = round3(item.quantity);
  if (balance !== item.quantity) await tx.stockItem.update({ where: { id: item.id }, data: { quantity: balance } });
  return tx.stockEntry.create({
    data: {
      restaurantId: item.restaurantId,
      stockItemId: item.id,
      type: e.type,
      quantity: round3(e.quantity),
      balance,
      cost: e.cost ?? null,
      supplier: e.supplier ?? null,
      note: e.note ?? null,
      orderId: e.orderId ?? null,
      date: e.date,
      createdByName: e.createdByName,
    },
  });
}

/** What a list of sold dishes uses from stock, by stock item. */
export function usageFor(
  items: Array<{ menuItemId: string | null; variant: string | null; quantity: number }>,
  recipe: Array<{ menuItemId: string; variant: string | null; stockItemId: string; quantity: number }>
): Map<string, number> {
  const used = new Map<string, number>();
  for (const i of items) {
    if (!i.menuItemId) continue;
    for (const r of recipe) {
      // A line without a portion counts for every portion; a portion line only for that portion.
      if (r.menuItemId !== i.menuItemId || (r.variant !== null && r.variant !== i.variant)) continue;
      used.set(r.stockItemId, round3((used.get(r.stockItemId) ?? 0) + r.quantity * i.quantity));
    }
  }
  return used;
}

/** A bill was paid: take the dishes' ingredients out of stock. */
export async function takeStockForOrder(tx: Db, order: FullOrder, date: string, by: string) {
  const items = order.items.filter((i) => i.status === "active" && i.menuItemId);
  if (items.length === 0) return;
  const recipe = await tx.recipeLine.findMany({ where: { menuItemId: { in: [...new Set(items.map((i) => i.menuItemId!))] } } });
  if (recipe.length === 0) return;
  const label = order.billNumber ? `Bill ${order.billNumber}` : `Order #${order.number}`;
  for (const [stockItemId, quantity] of usageFor(items, recipe)) {
    if (quantity > 0) await addStockEntry(tx, { stockItemId, type: "used", quantity: -quantity, date, createdByName: by, orderId: order.id, note: label });
  }
}

/** A paid bill was cancelled: put back what it took out of stock. */
export async function returnStockForOrder(tx: Db, order: Pick<FullOrder, "id" | "number" | "billNumber">, date: string, by: string) {
  const used = await tx.stockEntry.findMany({ where: { orderId: order.id, type: "used" } });
  const back = new Map<string, number>();
  for (const e of used) back.set(e.stockItemId, round3((back.get(e.stockItemId) ?? 0) - e.quantity));
  const label = `${order.billNumber ? `Bill ${order.billNumber}` : `Order #${order.number}`} cancelled`;
  for (const [stockItemId, quantity] of back) {
    if (quantity > 0) await addStockEntry(tx, { stockItemId, type: "returned", quantity, date, createdByName: by, orderId: order.id, note: label });
  }
}

export function isLow(item: { quantity: number; lowAt: number | null }) {
  return item.lowAt !== null && item.quantity <= item.lowAt;
}

export function stockValue(items: Array<{ quantity: number; costPerUnit: number; active: boolean }>) {
  return round2(items.filter((i) => i.active).reduce((s, i) => s + Math.max(0, i.quantity) * i.costPerUnit, 0));
}
