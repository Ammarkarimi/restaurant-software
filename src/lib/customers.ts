import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Db } from "./db";
import { fail } from "./api";
import { round2 } from "./billing";
import type { FullOrder } from "./orders";
import type { SettingsRecord } from "./settings";
import { normalizePhone } from "./phone";
import { formatCurrency } from "./utils";

export { normalizePhone };

/** Loyalty points a bill earns: a share of what the guest paid, in whole points. */
export function pointsFor(total: number, settings: Pick<SettingsRecord, "loyaltyEnabled" | "loyaltyEarnPercent">) {
  if (!settings.loyaltyEnabled || total <= 0) return 0;
  return Math.floor((total * Math.max(0, settings.loyaltyEarnPercent)) / 100);
}

/**
 * Called when a bill is paid: saves the guest (by phone) with their visit and spend,
 * takes off the points used and adds the points earned. Returns what to store on the order,
 * and the customer (null when the bill has no phone number).
 */
export async function recordVisit(tx: Db, order: FullOrder, total: number, settings: SettingsRecord): Promise<{ data: Prisma.OrderUpdateInput; customerId: string | null }> {
  const phone = normalizePhone(order.customerPhone);
  if (!phone) {
    if (order.pointsRedeemed > 0) fail("Add the customer's phone number to use loyalty points");
    return { data: { pointsEarned: 0 }, customerId: null };
  }
  const existing = await tx.customer.findFirst({ where: { phone } });
  if (order.pointsRedeemed > 0 && (existing?.points ?? 0) < order.pointsRedeemed) {
    fail(`This customer has only ${existing?.points ?? 0} points. Change the points used on this bill.`);
  }
  const earned = pointsFor(total, settings);
  const data = {
    visits: { increment: 1 },
    totalSpent: { increment: round2(total) },
    points: { increment: round2(earned - order.pointsRedeemed) },
    lastVisitAt: new Date(),
  };
  const customer = existing
    ? await tx.customer.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(order.customerName && { name: order.customerName }),
          ...(order.customerAddress && { address: order.customerAddress }),
        },
      })
    : await tx.customer.create({
        data: {
          restaurantId: order.restaurantId,
          phone,
          name: order.customerName,
          address: order.customerAddress,
          visits: 1,
          totalSpent: round2(total),
          points: round2(earned - order.pointsRedeemed),
          lastVisitAt: new Date(),
        },
      });
  return { data: { customer: { connect: { id: customer.id } }, pointsEarned: earned }, customerId: customer.id };
}

/**
 * Adds an entry to a customer's account and moves their balance: + money paid in, − a bill put on account.
 * A bill may not take them past their credit limit. Without a limit, only someone allowed to give
 * credit (the owner / manager) can let them owe money; others can only use money paid in advance.
 */
export async function addAccountEntry(
  tx: Db,
  entry: { customerId: string; type: string; amount: number; method?: string | null; orderId?: string | null; billNumber?: string | null; note?: string | null; date: string; createdByName: string },
  opts: { mayGiveCredit?: boolean } = {}
) {
  const customer = await tx.customer.findFirst({ where: { id: entry.customerId } });
  if (!customer) fail("Customer not found", 404);
  const amount = round2(entry.amount);
  const limit = customer.creditLimit ?? (opts.mayGiveCredit ? Infinity : 0);
  if (amount < 0 && round2(customer.balance + amount) < -limit) {
    const room = Math.max(0, round2(customer.balance + limit));
    const who = customer.name || customer.phone;
    fail(
      customer.creditLimit === null
        ? `${who} has ${formatCurrency(Math.max(0, customer.balance))} on their account. Only the owner / manager can let them pay later, or set a credit limit on their customer page.`
        : `${who} can owe at most ${formatCurrency(customer.creditLimit)}. Only ${formatCurrency(room)} more can go on their account.`
    );
  }
  const updated = await tx.customer.update({ where: { id: customer.id }, data: { balance: { increment: amount } } });
  await tx.customerTxn.create({
    data: {
      restaurantId: customer.restaurantId,
      customerId: customer.id,
      type: entry.type,
      amount,
      balance: round2(updated.balance),
      method: entry.method ?? null,
      orderId: entry.orderId ?? null,
      billNumber: entry.billNumber ?? null,
      note: entry.note ?? null,
      date: entry.date,
      createdByName: entry.createdByName,
    },
  });
  return round2(updated.balance);
}

/** A paid bill was cancelled: take back its visit, spend and points, and give back what went on their account. */
export async function reverseVisit(tx: Db, order: FullOrder, date: string, by: string) {
  if (!order.customerId) return;
  const onAccount = round2(order.payments.filter((p) => p.method === "account").reduce((s, p) => s + p.amount, 0));
  if (onAccount > 0) {
    await addAccountEntry(tx, { customerId: order.customerId, type: "refund", amount: onAccount, orderId: order.id, billNumber: order.billNumber, note: "Bill cancelled", date, createdByName: by });
  }
  const customer = await tx.customer.findFirst({ where: { id: order.customerId } });
  if (!customer) return;
  await tx.customer.update({
    where: { id: customer.id },
    data: {
      visits: Math.max(0, customer.visits - 1),
      totalSpent: Math.max(0, round2(customer.totalSpent - order.total)),
      points: Math.max(0, round2(customer.points + order.pointsRedeemed - order.pointsEarned)),
    },
  });
}

/** Customer details typed by the owner. */
export const customerSchema = z.object({
  phone: z.string().trim().min(1, "Phone is required").max(20),
  name: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  email: z.string().trim().email("Email is not valid").or(z.literal("")).nullable().optional(),
  birthday: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .nullable()
    .optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
