import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { assertEditable, buildLines, itemSummary, loadOrder, newItemSchema, saveTotals, sendUnsentToKitchen, serializeOrder } from "@/lib/orders";

const schema = z.object({
  items: z.array(newItemSchema).min(1, "Add at least one item").max(200),
  sendToKitchen: z.boolean().default(false),
});

/** Adds items to a running order, and optionally sends everything new to the kitchen. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const order = await loadOrder(id);
    assertEditable(order);
    if (body.items.length + order.items.length > 500) fail("This order has too many items. Please start a new order.");

    const result = await prisma.$transaction(async (tx) => {
      const lines = await buildLines(tx, body.items, settings);
      await tx.orderItem.createMany({ data: lines.map((l) => ({ ...l, orderId: id, restaurantId: settings.restaurantId })) });
      // New items mean the printed bill is out of date.
      if (order.status === "billed") await tx.order.update({ where: { id }, data: { status: "open" } });
      const kotNumber = body.sendToKitchen ? await sendUnsentToKitchen(tx, id) : null;
      return { order: await saveTotals(tx, await loadOrder(id, tx)), kotNumber, lines };
    });
    if (result.kotNumber) {
      const sent = result.order.items.filter((i) => i.kotNumber === result.kotNumber);
      await logActivity(user, "Sent to kitchen", `KOT ${result.kotNumber} for order #${order.number}: ${itemSummary(sent)}`);
    }
    return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber });
  });
}
