import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Db } from "./db";
import { fail } from "./api";
import { round2 } from "./billing";
import type { FullOrder } from "./orders";
import type { SettingsRecord } from "./settings";
import { normalizePhone } from "./phone";

export { normalizePhone };

/** Loyalty points a bill earns: a share of what the guest paid, in whole points. */
export function pointsFor(total: number, settings: Pick<SettingsRecord, "loyaltyEnabled" | "loyaltyEarnPercent">) {
  if (!settings.loyaltyEnabled || total <= 0) return 0;
  return Math.floor((total * Math.max(0, settings.loyaltyEarnPercent)) / 100);
}

/**
 * Called when a bill is paid: saves the guest (by phone) with their visit and spend,
 * takes off the points used and adds the points earned. Returns what to store on the order.
 */
export async function recordVisit(tx: Db, order: FullOrder, total: number, settings: SettingsRecord): Promise<Prisma.OrderUpdateInput> {
  const phone = normalizePhone(order.customerPhone);
  if (!phone) {
    if (order.pointsRedeemed > 0) fail("Add the customer's phone number to use loyalty points");
    return { pointsEarned: 0 };
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
  return { customer: { connect: { id: customer.id } }, pointsEarned: earned };
}

/** A paid bill was cancelled: take back its visit, spend and points. */
export async function reverseVisit(tx: Db, order: FullOrder) {
  if (!order.customerId) return;
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
