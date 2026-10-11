import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { activeItems, assertEditable, loadOrder, nextNumber, saveTotals, sendUnsentToKitchen, serializeOrder } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

/**
 * Prepares the bill for printing: gives it the next bill number (once), saves the
 * totals and marks the table as waiting for payment. Items the kitchen does not
 * have yet are sent first.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const settings = await getSettings();
    const order = await loadOrder(id);
    assertEditable(order);
    if (activeItems(order.items).length === 0) fail("Add items before printing the bill");

    const result = await prisma.$transaction(async (tx) => {
      const kotNumber = await sendUnsentToKitchen(tx, id);
      const billNumber = order.billNumber ?? `${settings.billPrefix}${await nextNumber(tx, "billSeq")}`;
      const updated = await saveTotals(tx, await loadOrder(id, tx), {
        status: "billed",
        billNumber,
        billedAt: new Date(),
      });
      return { order: updated, kotNumber };
    });
    await logActivity(
      user,
      order.billNumber ? "Reprinted bill" : "Printed bill",
      `Bill ${result.order.billNumber} for order #${order.number}: ${formatCurrency(result.order.total, settings.currency)}`
    );
    return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber });
  });
}
