import { prisma } from "./db";
import { round2 } from "./billing";
import { ACTIVE_STATUSES } from "./orders";

export const EXPENSE_CATEGORIES = [
  "Vegetables & fruit",
  "Groceries",
  "Meat & fish",
  "Dairy",
  "Gas / fuel",
  "Staff salary / advance",
  "Rent",
  "Electricity & water",
  "Repairs",
  "Cleaning",
  "Packaging",
  "Marketing",
  "Other",
];

export const EXPENSE_METHODS = ["cash", "upi", "card", "bank"] as const;

export interface DaySummaryJson {
  payments: Array<{ method: string; amount: number; count: number }>;
  /** Money received against customer accounts (dues paid, wallet top-ups), by method. */
  received?: Array<{ method: string; amount: number; count: number }>;
  expenses: Array<{ category: string; amount: number }>;
  discount: number;
  tax: number;
  cancelled: number;
}

/** What happened on one business day: sales by payment mode, expenses, and the cash that should be in the drawer. */
export async function daySummary(date: string) {
  const [orders, cancelled, expenses, running, close, previous, receipts] = await Promise.all([
    prisma.order.findMany({ where: { status: "settled", businessDate: date }, select: { total: true, guests: true, discountAmount: true, taxAmount: true, payments: true } }),
    prisma.order.count({ where: { status: "cancelled", businessDate: date } }),
    prisma.expense.findMany({ where: { date }, orderBy: { createdAt: "asc" } }),
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.dayClose.findFirst({ where: { date } }),
    prisma.dayClose.findFirst({ where: { date: { lt: date } }, orderBy: { date: "desc" } }),
    prisma.customerTxn.findMany({ where: { date, type: "received" }, select: { method: true, amount: true } }),
  ]);

  const byMethod = new Map<string, { method: string; amount: number; count: number }>();
  for (const o of orders) {
    for (const p of o.payments) {
      const m = byMethod.get(p.method) ?? { method: p.method, amount: 0, count: 0 };
      m.amount += p.amount;
      m.count += 1;
      byMethod.set(p.method, m);
    }
  }
  const received = new Map<string, { method: string; amount: number; count: number }>();
  for (const r of receipts) {
    const m = received.get(r.method ?? "cash") ?? { method: r.method ?? "cash", amount: 0, count: 0 };
    m.amount += r.amount;
    m.count += 1;
    received.set(m.method, m);
  }
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);

  const sales = round2(orders.reduce((s, o) => s + o.total, 0));
  const cashSales = round2(byMethod.get("cash")?.amount ?? 0);
  const cashExpenses = round2(expenses.filter((e) => e.method === "cash").reduce((s, e) => s + e.amount, 0));
  const cashReceived = round2(received.get("cash")?.amount ?? 0);
  const openingCash = close ? close.openingCash : (previous?.cashLeft ?? 0);

  return {
    date,
    bills: orders.length,
    guests: orders.reduce((s, o) => s + o.guests, 0),
    sales,
    discount: round2(orders.reduce((s, o) => s + o.discountAmount, 0)),
    tax: round2(orders.reduce((s, o) => s + o.taxAmount, 0)),
    cancelled,
    payments: [...byMethod.values()].map((m) => ({ ...m, amount: round2(m.amount) })).sort((a, b) => b.amount - a.amount),
    expenses,
    expensesTotal: round2(expenses.reduce((s, e) => s + e.amount, 0)),
    expensesByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    received: [...received.values()].map((m) => ({ ...m, amount: round2(m.amount) })).sort((a, b) => b.amount - a.amount),
    cashReceived,
    cashSales,
    cashExpenses,
    openingCash,
    expectedCash: round2(openingCash + cashSales + cashReceived - cashExpenses),
    runningOrders: running,
    close,
    previousClose: previous ? { date: previous.date, cashLeft: previous.cashLeft } : null,
  };
}

export type DaySummary = Awaited<ReturnType<typeof daySummary>>;
