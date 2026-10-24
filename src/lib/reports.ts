import { prisma } from "./db";
import { round2 } from "./billing";
import { addDays, diffDays } from "./dates";
import { orderInclude, totalsOf } from "./orders";

export interface ReportRange {
  from: string;
  to: string;
  timezone: string;
}

function hourIn(date: Date, timeZone: string) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(date)) % 24;
  } catch {
    return date.getUTCHours();
  }
}

/** Paid bills whose business day is between `from` and `to` (inclusive). */
export async function settledOrders(range: ReportRange) {
  return prisma.order.findMany({
    where: { status: "settled", businessDate: { gte: range.from, lte: range.to } },
    include: orderInclude,
    orderBy: { settledAt: "asc" },
  });
}

export async function salesReport(range: ReportRange) {
  const [orders, cancelled, expenseRows] = await Promise.all([
    settledOrders(range),
    prisma.order.findMany({
      where: { status: "cancelled", businessDate: { gte: range.from, lte: range.to } },
      select: { id: true, number: true, billNumber: true, total: true, cancelReason: true, cancelledAt: true, createdByName: true, table: { select: { name: true } } },
      orderBy: { cancelledAt: "desc" },
    }),
    prisma.expense.groupBy({ by: ["category"], where: { date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
  ]);
  const expenses = expenseRows.map((e) => ({ category: e.category, amount: round2(e._sum.amount ?? 0) })).sort((a, b) => b.amount - a.amount);

  const days = new Map<string, { date: string; sales: number; bills: number }>();
  for (let d = range.from; d <= range.to && days.size < 400; d = addDays(d, 1)) days.set(d, { date: d, sales: 0, bills: 0 });
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, bills: 0 }));
  const byType = new Map<string, { type: string; sales: number; bills: number }>();
  const bySource = new Map<string, { source: string; sales: number; bills: number }>();
  const byMethod = new Map<string, { method: string; amount: number; count: number }>();
  const items = new Map<string, { name: string; category: string; quantity: number; amount: number }>();
  const categories = new Map<string, { category: string; quantity: number; amount: number }>();
  const taxes = new Map<number, { rate: number; taxable: number; tax: number }>();
  const staff = new Map<string, { name: string; sales: number; bills: number }>();

  const totals = { sales: 0, bills: orders.length, guests: 0, itemsTotal: 0, discount: 0, pointsDiscount: 0, serviceCharge: 0, charges: 0, tax: 0, roundOff: 0, taxable: 0 };

  for (const o of orders) {
    const t = totalsOf(o);
    totals.sales += t.total;
    totals.guests += o.guests;
    totals.itemsTotal += t.itemsTotal;
    totals.discount += t.discount;
    totals.pointsDiscount += t.pointsDiscount;
    totals.serviceCharge += t.serviceCharge;
    totals.charges += t.chargesTotal;
    totals.tax += t.tax;
    totals.roundOff += t.roundOff;
    totals.taxable += t.taxable;

    const day = days.get(o.businessDate!);
    if (day) {
      day.sales += t.total;
      day.bills += 1;
    }
    if (o.settledAt) {
      const h = hours[hourIn(o.settledAt, range.timezone)];
      h.sales += t.total;
      h.bills += 1;
    }
    const type = byType.get(o.type) ?? { type: o.type, sales: 0, bills: 0 };
    type.sales += t.total;
    type.bills += 1;
    byType.set(o.type, type);
    const source = bySource.get(o.source) ?? { source: o.source, sales: 0, bills: 0 };
    source.sales += t.total;
    source.bills += 1;
    bySource.set(o.source, source);

    for (const p of o.payments) {
      const m = byMethod.get(p.method) ?? { method: p.method, amount: 0, count: 0 };
      m.amount += p.amount;
      m.count += 1;
      byMethod.set(p.method, m);
    }
    for (const i of o.items) {
      if (i.status !== "active") continue;
      const name = i.variant ? `${i.name} (${i.variant})` : i.name;
      const category = i.categoryName || "Other";
      const amount = i.price * i.quantity;
      const it = items.get(name) ?? { name, category, quantity: 0, amount: 0 };
      it.quantity += i.quantity;
      it.amount += amount;
      items.set(name, it);
      const c = categories.get(category) ?? { category, quantity: 0, amount: 0 };
      c.quantity += i.quantity;
      c.amount += amount;
      categories.set(category, c);
    }
    for (const tl of t.taxLines) {
      const x = taxes.get(tl.rate) ?? { rate: tl.rate, taxable: 0, tax: 0 };
      x.taxable += tl.taxable;
      x.tax += tl.tax;
      taxes.set(tl.rate, x);
    }
    const who = o.createdByName || "Unknown";
    const s = staff.get(who) ?? { name: who, sales: 0, bills: 0 };
    s.sales += t.total;
    s.bills += 1;
    staff.set(who, s);
  }

  const r2 = <T extends Record<string, unknown>>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "number" ? round2(v) : v])) as T;

  return {
    range: { from: range.from, to: range.to, days: diffDays(range.from, range.to) + 1 },
    totals: r2({ ...totals, averageBill: orders.length ? totals.sales / orders.length : 0 }),
    daily: [...days.values()].map(r2),
    hourly: hours.filter((h) => h.bills > 0).map(r2),
    byType: [...byType.values()].map(r2).sort((a, b) => b.sales - a.sales),
    bySource: [...bySource.values()].map(r2).sort((a, b) => b.sales - a.sales),
    payments: [...byMethod.values()].map(r2).sort((a, b) => b.amount - a.amount),
    topItems: [...items.values()].map(r2).sort((a, b) => b.quantity - a.quantity || b.amount - a.amount),
    categories: [...categories.values()].map(r2).sort((a, b) => b.amount - a.amount),
    taxes: [...taxes.values()].map(r2).sort((a, b) => a.rate - b.rate),
    staff: [...staff.values()].map(r2).sort((a, b) => b.sales - a.sales),
    expenses: { total: round2(expenses.reduce((sum, e) => sum + e.amount, 0)), byCategory: expenses },
    cancelled: {
      count: cancelled.length,
      value: round2(cancelled.reduce((sum, o) => sum + o.total, 0)),
      orders: cancelled.slice(0, 50),
    },
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
