import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { round2 } from "@/lib/billing";
import { loadOrder, serializeOrder } from "@/lib/orders";
import { PAYMENT_METHODS, formatCurrency, label } from "@/lib/utils";

const schema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amount: z.coerce.number().positive("Each payment needs an amount").max(100_000_000),
        reference: z.string().trim().max(100).optional().nullable(),
      })
    )
    .min(1)
    .max(10),
});

/**
 * Corrects how a paid bill was paid, e.g. the cashier pressed Cash but the guest paid by UPI.
 * The amount stays the same; the change is kept in the activity history.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const order = await loadOrder(id);
    if (order.status !== "settled") fail("Only paid bills can have their payment changed.");
    const onAccount = (m: string) => m === "account";
    if (order.payments.some((p) => onAccount(p.method)) || body.payments.some((p) => onAccount(p.method))) {
      fail("Bills on a customer's account are changed from the customer's page.");
    }
    const paying = round2(body.payments.reduce((sum, p) => sum + p.amount, 0));
    if (Math.abs(paying - order.total) > 0.01) fail(`The payments must add up to the bill, ${formatCurrency(order.total, settings.currency)}`);
    const before = order.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount, settings.currency)}`).join(" + ");
    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: id } });
      await tx.payment.createMany({
        data: body.payments.map((p) => ({ restaurantId: order.restaurantId, orderId: id, method: p.method, amount: round2(p.amount), reference: p.reference || null, receivedBy: order.payments[0]?.receivedBy ?? user.name, paidAt: order.settledAt ?? new Date() })),
      });
      return loadOrder(id, tx);
    });
    const after = updated.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount, settings.currency)}`).join(" + ");
    const closed = order.businessDate ? await prisma.dayClose.findFirst({ where: { date: order.businessDate } }) : null;
    await logActivity(user, "Changed payment mode", `Bill ${order.billNumber}: ${before} → ${after}${closed ? " (that day was already closed)" : ""}`);
    return NextResponse.json({ order: serializeOrder(updated), dayClosed: !!closed });
  });
}
