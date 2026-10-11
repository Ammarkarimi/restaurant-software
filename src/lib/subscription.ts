// Monthly subscription maths for the software provider: which months each restaurant
// has paid for, what is still owed and which months are late.
// Months are "YYYY-MM" strings so they compare and sort as text.

export type MonthStatus = "paid" | "part_paid" | "unpaid" | "free";

export interface SubscriptionPaymentLike {
  month: string;
  amount: number;
  clearsMonth: boolean;
}

export interface MonthLine {
  month: string;
  status: MonthStatus;
  paid: number;
  due: number;
}

export interface SubscriptionSummary {
  /** Every month from the first charged month to now, plus any months paid in advance. Newest first. */
  months: MonthLine[];
  currentMonth: string;
  currentStatus: MonthStatus | "not_started";
  /** Months before this one that are not fully paid. */
  overdueMonths: string[];
  /** Money still owed, including this month. */
  outstanding: number;
  /** Paid in advance up to and including this month, if any. */
  paidUntil: string | null;
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/** The month of a "YYYY-MM-DD" day. */
export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Inclusive list of months from `from` to `to` (empty if `from` is later). */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let m = from; m <= to && months.length < 600; m = addMonths(m, 1)) months.push(m);
  return months;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function subscriptionSummary(
  account: { monthlyFee: number; billingStart: string },
  payments: SubscriptionPaymentLike[],
  currentMonth: string
): SubscriptionSummary {
  const byMonth = new Map<string, SubscriptionPaymentLike[]>();
  for (const p of payments) byMonth.set(p.month, [...(byMonth.get(p.month) ?? []), p]);

  const fee = Math.max(0, account.monthlyFee);
  const lineFor = (month: string): MonthLine => {
    const list = byMonth.get(month) ?? [];
    const paid = round2(list.reduce((sum, p) => sum + p.amount, 0));
    if (fee === 0) return { month, status: "free", paid, due: 0 };
    const cleared = list.some((p) => p.clearsMonth) || paid >= fee;
    if (cleared) return { month, status: "paid", paid, due: 0 };
    return { month, status: paid > 0 ? "part_paid" : "unpaid", paid, due: round2(fee - paid) };
  };

  const charged = monthRange(account.billingStart, currentMonth);
  const advance = [...byMonth.keys()].filter((m) => m > currentMonth && m >= account.billingStart);
  const months = [...new Set([...charged, ...advance])].sort().map(lineFor);

  const isOpen = (l: MonthLine) => l.status === "unpaid" || l.status === "part_paid";
  const current = months.find((l) => l.month === currentMonth);

  let paidUntil: string | null = null;
  if (current && !isOpen(current)) {
    paidUntil = currentMonth;
    while (months.some((l) => l.month === addMonths(paidUntil!, 1) && l.status === "paid")) {
      paidUntil = addMonths(paidUntil, 1);
    }
  }

  return {
    months: months.reverse(),
    currentMonth,
    currentStatus: current ? current.status : "not_started",
    overdueMonths: months.filter((l) => l.month < currentMonth && isOpen(l)).map((l) => l.month).sort(),
    outstanding: round2(months.filter((l) => l.month <= currentMonth).reduce((sum, l) => sum + l.due, 0)),
    paidUntil: fee === 0 ? null : paidUntil,
  };
}
