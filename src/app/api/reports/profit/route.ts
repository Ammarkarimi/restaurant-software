import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { isDateKey } from "@/lib/dates";
import { settledOrders } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { totalsOf } from "@/lib/orders";
import { totalsOfEvent } from "@/lib/banquet-server";
import { menuEngineering, profitAndLoss, type DishSales } from "@/lib/profit";

/** Profit & loss and menu engineering for ?from=YYYY-MM-DD&to=YYYY-MM-DD. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    if (!isDateKey(from) || !isDateKey(to) || from > to) fail("Choose the dates");
    const settings = await getSettings();
    const [orders, recipe, stock, purchases, expenses, events] = await Promise.all([
      settledOrders({ from, to, timezone: settings.timezone }),
      prisma.recipeLine.findMany({ select: { menuItemId: true, variant: true, stockItemId: true, quantity: true } }),
      prisma.stockItem.findMany({ select: { id: true, costPerUnit: true } }),
      prisma.stockEntry.aggregate({ where: { type: "purchase", date: { gte: from, lte: to } }, _sum: { cost: true } }),
      prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, select: { category: true, amount: true, notes: true } }),
      prisma.banquetEvent.findMany({ where: { status: "completed", invoiceNumber: { not: null }, businessDate: { gte: from, lte: to } } }),
    ]);
    const costOf = new Map(stock.map((s) => [s.id, s.costPerUnit]));
    const unitCost = (menuItemId: string | null, variant: string | null) => {
      if (!menuItemId) return null;
      const lines = recipe.filter((r) => r.menuItemId === menuItemId && (r.variant === null || r.variant === variant));
      if (!lines.length) return null;
      return lines.reduce((s, l) => s + l.quantity * (costOf.get(l.stockItemId) ?? 0), 0);
    };

    let netSales = 0;
    const dishes = new Map<string, DishSales>();
    for (const o of orders) {
      const t = totalsOf(o);
      netSales += t.total - t.tax - t.roundOff;
      // Each dish's share of the bill after discount, before tax.
      const keep = t.itemsTotal > 0 ? Math.max(0, (t.itemsTotal - t.discount) / t.itemsTotal) : 0;
      for (const i of o.items) {
        if (i.status !== "active") continue;
        const gross = i.price * i.quantity;
        const beforeTax = o.pricesIncludeTax && o.taxMode !== "none" ? gross / (1 + i.taxRate / 100) : gross;
        const key = `${i.menuItemId ?? i.name}|${i.variant ?? ""}`;
        const d = dishes.get(key) ?? { key, name: i.variant ? `${i.name} (${i.variant})` : i.name, category: i.categoryName ?? "", quantity: 0, revenue: 0, unitCost: unitCost(i.menuItemId, i.variant) };
        d.quantity += i.quantity;
        d.revenue += beforeTax * keep;
        dishes.set(key, d);
      }
    }
    const menu = menuEngineering([...dishes.values()]);
    const costed = menu.rows.filter((r) => r.unitCost !== null);
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      // Stock bought with cash from the till is saved as stock (with its cost) and as a Groceries expense.
      if (e.notes?.startsWith("Stock: ")) continue;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    const pnl = profitAndLoss({
      netSales,
      banquetSales: events.reduce((s, e) => s + totalsOfEvent(e).taxable, 0),
      stockPurchases: purchases._sum.cost ?? 0,
      expenses: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })),
      recipeCost: costed.length ? costed.reduce((s, r) => s + r.unitCost! * r.quantity, 0) : null,
    });
    return NextResponse.json({ from, to, pnl, menu, bills: orders.length, banquets: events.length });
  });
}
