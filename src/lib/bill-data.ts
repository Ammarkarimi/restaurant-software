import type { BillData } from "@/components/bill-view";
import type { FullOrder } from "./orders";
import { activeItems, totalsOf } from "./orders";
import { formatCurrency } from "./utils";

/** Merges identical lines (same dish, portion, price and note) so the bill stays short. */
export function billItems(order: FullOrder) {
  const merged = new Map<string, BillData["items"][number]>();
  for (const i of activeItems(order.items)) {
    const key = [i.menuItemId ?? i.name, i.variant, i.price, i.note].join("|");
    const line = merged.get(key);
    if (line) line.quantity += i.quantity;
    else merged.set(key, { name: i.name, variant: i.variant, foodType: i.foodType, quantity: i.quantity, price: i.price, note: i.note });
  }
  return [...merged.values()];
}

export function billDataFor(order: FullOrder, currency: string): BillData {
  return {
    billNumber: order.billNumber,
    orderNumber: order.number,
    type: order.type,
    tableName: order.table?.name ?? null,
    guests: order.guests,
    servedBy: order.createdByName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    date: order.settledAt ?? order.billedAt ?? order.createdAt,
    items: billItems(order),
    totals: totalsOf(order),
    taxMode: order.taxMode,
    taxName: order.taxName,
    pricesIncludeTax: order.pricesIncludeTax,
    serviceChargePercent: order.serviceChargePercent,
    discountLabel:
      order.discountValue > 0 ? (order.discountType === "percent" ? `${order.discountValue}%` : formatCurrency(order.discountValue, currency)) : null,
    payments: order.payments.map((p) => ({ method: p.method, amount: p.amount })),
    status: order.status,
  };
}
