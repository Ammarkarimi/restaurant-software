import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { activeItems, loadOrder, totalsOf } from "@/lib/orders";

// The counter sends its open order every 20 seconds; an order not sent for this long is gone
// (the counter closed the page, lost power or the internet).
const SHOW_FOR_MS = 45_000;
// After payment, "Thank you" stays this long.
const THANKS_MS = 90_000;

/**
 * What the screen facing the guest shows: the order the counter has open, item by item, with the
 * total and (once the bill is printed) a UPI QR for the exact amount.
 */
export async function GET() {
  return withAuth(
    async () => {
      const settings = await getSettings();
      const base = { restaurantName: settings.restaurantName, upiId: settings.upiId, currency: settings.currency };
      if (!settings.displayOrderId || !settings.displayAt || Date.now() - settings.displayAt.getTime() > SHOW_FOR_MS) return NextResponse.json({ ...base, order: null });
      const order = await loadOrder(settings.displayOrderId).catch(() => null);
      if (!order || order.status === "cancelled") return NextResponse.json({ ...base, order: null });
      if (order.status === "settled" && (!order.settledAt || Date.now() - order.settledAt.getTime() > THANKS_MS)) return NextResponse.json({ ...base, order: null });
      const t = totalsOf(order);
      return NextResponse.json({
        ...base,
        order: {
          id: order.id,
          number: order.number,
          billNumber: order.billNumber,
          status: order.status,
          table: order.table?.name ?? null,
          customerName: order.customerName,
          items: activeItems(order.items).map((i) => ({ id: i.id, name: i.name, variant: i.variant, quantity: i.quantity, amount: Math.round(i.price * i.quantity * 100) / 100 })),
          itemsTotal: t.itemsTotal,
          discount: t.discount,
          serviceCharge: t.serviceCharge,
          charges: t.chargesTotal,
          tax: t.tax,
          roundOff: t.roundOff,
          total: t.total,
        },
      });
    },
    { kitchen: true }
  );
}

const schema = z.object({ orderId: z.string().max(40).nullable() });

/** The counter opened (or closed) an order: show it on the guest's screen. */
export async function PUT(request: NextRequest) {
  return withAuth(async () => {
    const { orderId } = schema.parse(await request.json());
    const settings = await getSettings();
    if (orderId && !(await prisma.order.findFirst({ where: { id: orderId }, select: { id: true } }))) return NextResponse.json({ ok: false });
    await prisma.restaurantSettings.update({ where: { restaurantId: settings.restaurantId }, data: { displayOrderId: orderId, displayAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}

/** The same, sent as a beacon when the counter's page closes (beacons can only POST). */
export const POST = PUT;
