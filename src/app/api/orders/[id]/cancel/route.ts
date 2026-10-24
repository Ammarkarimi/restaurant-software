import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { reverseVisit } from "@/lib/customers";
import { loadOrder, saveTotals, serializeOrder } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({ reason: z.string().trim().min(2, "Please give a reason for cancelling").max(300) });

/**
 * Cancels an order. Anyone can cancel an order the kitchen has not started on.
 * Once food went to the kitchen, a bill was printed or it was paid, only the
 * owner / manager can cancel it — a common way money goes missing at the counter.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const { reason } = schema.parse(await request.json());
    const settings = await getSettings();
    const order = await loadOrder(id);
    if (order.status === "cancelled") fail("This order is already cancelled");
    const kitchenHasIt = order.items.some((i) => i.kotNumber !== null);
    if ((kitchenHasIt || order.status !== "open") && !isAdmin(user)) {
      fail("Only the owner / manager can cancel an order after it went to the kitchen or was billed.", 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (order.status === "settled") await reverseVisit(tx, order);
      return saveTotals(tx, order, {
        status: "cancelled",
        cancelReason: reason,
        cancelledAt: new Date(),
        businessDate: order.businessDate ?? todayKey(settings.timezone),
        activeTable: { disconnect: true },
      });
    });
    const what = order.billNumber ? `Bill ${order.billNumber} (order #${order.number})` : `Order #${order.number}`;
    await logActivity(user, order.status === "settled" ? "Cancelled a paid bill" : "Cancelled order", `${what}, ${formatCurrency(updated.total, settings.currency)}: ${reason}`);
    return NextResponse.json({ order: serializeOrder(updated) });
  });
}
