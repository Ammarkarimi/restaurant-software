import { NextRequest, NextResponse } from "next/server";
import { rawPrisma, runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { advanceAggregatorOrder, applyStatusWebhook, createAggregatorOrder, isOrderRelay, parseUrbanPiperOrder } from "@/lib/aggregator";

/**
 * UrbanPiper sends Zomato / Swiggy orders (Order Relay) and status changes here. The secret part
 * of the address identifies the restaurant; it is shown in Settings → UPI & Zomato / Swiggy.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const owner = token.length >= 20 ? await rawPrisma.restaurantSettings.findUnique({ where: { aggregatorToken: token }, select: { restaurantId: true, aggregatorEnabled: true } }) : null;
  if (!owner || !owner.aggregatorEnabled) return NextResponse.json({ error: "Unknown address" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    return await runForRestaurant(owner.restaurantId, async () => {
      if (isOrderRelay(body)) {
        const settings = await getSettings();
        const parsed = parseUrbanPiperOrder(body);
        if (!parsed.items.length) return NextResponse.json({ error: "Order has no items" }, { status: 400 });
        const { order, created } = await createAggregatorOrder(settings, parsed);
        if (created && settings.aggregatorAutoAccept) await advanceAggregatorOrder(settings, order.id, "acknowledged", "Auto-accept");
        return NextResponse.json({ ok: true, order: order.number, created });
      }
      const r = await applyStatusWebhook(body as Record<string, unknown>);
      return NextResponse.json({ ok: true, ...r });
    });
  } catch (error) {
    console.error("Aggregator webhook failed", error);
    // 5xx makes UrbanPiper retry later.
    return NextResponse.json({ error: "Could not save the order" }, { status: 500 });
  }
}
