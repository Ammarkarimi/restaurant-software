import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { pushStatus, upOrderId } from "@/lib/aggregator";
import { assertEditable, itemSummary, loadOrder, sendUnsentToKitchen, serializeOrder } from "@/lib/orders";

/** Sends every new item to the kitchen as one kitchen order ticket (KOT). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const order = await loadOrder(id);
    assertEditable(order);
    const result = await prisma.$transaction(async (tx) => {
      const kotNumber = await sendUnsentToKitchen(tx, id);
      return { kotNumber, order: await loadOrder(id, tx) };
    });
    if (!result.kotNumber) fail("There are no new items to send to the kitchen");
    const sent = result.order.items.filter((i) => i.kotNumber === result.kotNumber);
    await logActivity(user, "Sent to kitchen", `KOT ${result.kotNumber} for order #${order.number}: ${itemSummary(sent)}`);
    // Sending a new Zomato / Swiggy order to the kitchen accepts it on the app too.
    if (order.aggregatorStatus === "placed") {
      const up = upOrderId(order);
      await prisma.order.update({ where: { id }, data: { aggregatorStatus: "acknowledged" } });
      if (up) await pushStatus(await getSettings(), up, "acknowledged");
      result.order.aggregatorStatus = "acknowledged";
    }
    return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber });
  });
}
