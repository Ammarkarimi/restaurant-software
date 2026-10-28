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

/** % each app keeps, from settings, e.g. { zomato: 25, swiggy: 22 }. */
export function parseCommission(json: string | null | undefined): Record<string, number> {
  try {
    const o = JSON.parse(json || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "number" && v >= 0 && v <= 60)) as Record<string, number> : {};
  } catch {
    return {};
  }
}

export async function salesReport(range: ReportRange, opts: { commission?: Record<string, number> } = {}) {
  const [orders, cancelled, expenseRows, removedItems, received, creditGiven] = await Promise.all([
    settledOrders(range),
    prisma.order.findMany({
      where: { status: "cancelled", businessDate: { gte: range.from, lte: range.to } },
      select: { id: true, number: true, billNumber: true, total: true, cancelReason: true, cancelledAt: true, createdByName: true, table: { select: { name: true } } },
      orderBy: { cancelledAt: "desc" },
    }),
    prisma.expense.groupBy({ by: ["category"], where: { date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    // Dishes taken off after the kitchen had them: worth watching.
    prisma.orderItem.findMany({
      where: { status: "cancelled", kotNumber: { not: null }, order: { businessDate: { gte: range.from, lte: range.to } } },
      select: { id: true, name: true, variant: true, quantity: true, price: true, cancelReason: true, order: { select: { id: true, number: true, billNumber: true, createdByName: true, table: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.customerTxn.aggregate({ where: { type: "received", date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
    prisma.customerTxn.aggregate({ where: { type: "bill", date: { gte: range.from, lte: range.to } }, _sum: { amount: true } }),
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
  const weekdays = Array.from({ length: 7 }, (_, d) => ({ day: d, sales: 0, bills: 0 }));
  const riders = new Map<string, { name: string; orders: number; delivered: number; minutes: number; timed: number; cash: number }>();
  const discountRows: Array<{ id: string; billNumber: string | null; amount: number; reason: string | null; by: string | null; offer: boolean }> = [];
  const complimentary = { count: 0, value: 0 };

  const totals = { sales: 0, bills: orders.length, guests: 0, itemsTotal: 0, discount: 0, pointsDiscount: 0, serviceCharge: 0, charges: 0, tax: 0, roundOff: 0, taxable: 0 };

  for (const o of orders) {
    const t = totalsOf(o);
    totals.sales += t.total;
    totals.guests += o.guests;
    totals.itemsTotal += t.itemsTotal;
    // Complimentary bills are kept apart, so "discounts" means money really given off.
    if (o.complimentary) {
      complimentary.count += 1;
      complimentary.value += t.itemsTotal;
    } else {
      totals.discount += t.discount;
      if (t.discount - t.pointsDiscount > 0) {
        discountRows.push({ id: o.id, billNumber: o.billNumber, amount: round2(t.discount - t.pointsDiscount), reason: o.discountReason, by: o.createdByName, offer: !!o.offerId });
      }
    }
    if (o.businessDate) {
      const w = weekdays[new Date(`${o.businessDate}T12:00:00Z`).getUTCDay()];
      w.sales += t.total;
      w.bills += 1;
    }
    if (o.type === "delivery" && o.riderName) {
      const r = riders.get(o.riderName) ?? { name: o.riderName, orders: 0, delivered: 0, minutes: 0, timed: 0, cash: 0 };
      r.orders += 1;
      if (o.deliveryStatus === "delivered") r.delivered += 1;
      if (o.outAt && o.deliveredAt) {
        r.minutes += (o.deliveredAt.getTime() - o.outAt.getTime()) / 60_000;
        r.timed += 1;
      }
      r.cash += o.payments.filter((p) => p.method === "cash").reduce((sum, p) => sum + p.amount, 0);
      riders.set(o.riderName, r);
    }
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

  const feedback = orders.length
    ? await prisma.feedback.aggregate({ where: { orderId: { in: orders.map((o) => o.id) } }, _avg: { rating: true }, _count: true })
    : { _avg: { rating: null }, _count: 0 };
  const commission = opts.commission ?? {};

  const r2 = <T extends Record<string, unknown>>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "number" ? round2(v) : v])) as T;

  return {
    range: { from: range.from, to: range.to, days: diffDays(range.from, range.to) + 1 },
    totals: r2({ ...totals, averageBill: orders.length ? totals.sales / orders.length : 0 }),
    daily: [...days.values()].map(r2),
    hourly: hours.filter((h) => h.bills > 0).map(r2),
    byType: [...byType.values()].map(r2).sort((a, b) => b.sales - a.sales),
    bySource: [...bySource.values()]
      .map((x) => {
        const pct = commission[x.source] ?? 0;
        return r2({ ...x, commissionPercent: pct, commission: (x.sales * pct) / 100, payout: x.sales - (x.sales * pct) / 100 });
      })
      .sort((a, b) => b.sales - a.sales),
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
    complimentary: r2(complimentary),
    discounts: {
      list: discountRows.sort((a, b) => b.amount - a.amount).slice(0, 50).map(r2),
      byStaff: [...discountRows.reduce((m, d) => m.set(d.by ?? "Unknown", (m.get(d.by ?? "Unknown") ?? 0) + d.amount), new Map<string, number>()).entries()]
        .map(([name, amount]) => ({ name, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount),
      offers: round2(discountRows.filter((d) => d.offer).reduce((sum, d) => sum + d.amount, 0)),
    },
    removedItems: {
      count: removedItems.reduce((sum, i) => sum + i.quantity, 0),
      value: round2(removedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)),
      list: removedItems.slice(0, 50).map((i) => ({ id: i.id, name: i.variant ? `${i.name} (${i.variant})` : i.name, quantity: i.quantity, value: round2(i.price * i.quantity), reason: i.cancelReason, order: i.order })),
    },
    weekdays: weekdays.map(r2),
    riders: [...riders.values()].map((r) => r2({ name: r.name, orders: r.orders, delivered: r.delivered, avgMinutes: r.timed ? r.minutes / r.timed : 0, cash: r.cash })).sort((a, b) => b.orders - a.orders),
    rating: { average: feedback._avg.rating ? round2(feedback._avg.rating) : null, count: feedback._count },
    accounts: { credit: round2(-(creditGiven._sum.amount ?? 0)), received: round2(received._sum.amount ?? 0) },
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
