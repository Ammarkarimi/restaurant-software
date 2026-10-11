import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { round2 } from "@/lib/billing";
import { todayKey } from "@/lib/dates";
import { activeItems, assertEditable, loadOrder, nextNumber, saveTotals, sendUnsentToKitchen, serializeOrder, totalsOf } from "@/lib/orders";
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
    .max(10),
});

/** Takes payment (cash, UPI, card or a mix) and closes the bill. The table becomes free. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const order = await loadOrder(id);
    assertEditable(order);
    if (activeItems(order.items).length === 0) fail("Add items before taking payment");

    const total = totalsOf(order).total;
    const paying = round2(body.payments.reduce((sum, p) => sum + p.amount, 0));
    if (Math.abs(paying - total) > 0.01) {
      fail(
        paying < total
          ? `${formatCurrency(round2(total - paying), settings.currency)} is still to be paid`
          : `The payments add up to ${formatCurrency(round2(paying - total), settings.currency)} more than the bill`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const kotNumber = await sendUnsentToKitchen(tx, id);
      const billNumber = order.billNumber ?? `${settings.billPrefix}${await nextNumber(tx, "billSeq")}`;
      if (body.payments.length) {
        await tx.payment.createMany({
          data: body.payments.map((p) => ({ restaurantId: settings.restaurantId, orderId: id, method: p.method, amount: round2(p.amount), reference: p.reference || null, receivedBy: user.name })),
        });
      }
      const now = new Date();
      const updated = await saveTotals(tx, await loadOrder(id, tx), {
        status: "settled",
        billNumber,
        billedAt: order.billedAt ?? now,
        settledAt: now,
        businessDate: todayKey(settings.timezone),
        activeTable: { disconnect: true },
      });
      return { order: updated, kotNumber };
    });
    const how = body.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount, settings.currency)}`).join(" + ") || "nothing to pay";
    await logActivity(user, "Took payment", `Bill ${result.order.billNumber} (order #${order.number}): ${how}`);
    return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber });
  });
}
