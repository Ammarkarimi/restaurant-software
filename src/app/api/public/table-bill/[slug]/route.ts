import { NextRequest, NextResponse } from "next/server";
import { prisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { findPublicRestaurant, tableForToken } from "@/lib/public-menu";
import { ACTIVE_STATUSES, orderInclude, totalsOf } from "@/lib/orders";
import { paidAmount, round2 } from "@/lib/billing";
import { upiLink } from "@/components/bill-view";

/** The table's printed bill, so guests can pay by UPI from the table QR code (scan & pay). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = new URL(request.url).searchParams.get("t");
    const found = await findPublicRestaurant(slug);
    if (!found) fail("This menu is not available", 404);
    return await runForRestaurant(found.restaurant.id, async () => {
      const table = await tableForToken(token);
      if (!table) fail("This QR code is no longer valid", 404);
      const order = await prisma.order.findFirst({ where: { activeTableId: table.id, status: { in: ACTIVE_STATUSES } }, include: orderInclude });
      // Only once the bill is printed: before that the order can still change.
      if (!order || order.status !== "billed") return NextResponse.json({ bill: null });
      const t = totalsOf(order);
      const due = round2(t.total - paidAmount(order.payments));
      const s = found.settings;
      return NextResponse.json({
        bill: {
          billNumber: order.billNumber,
          total: t.total,
          due,
          items: order.items.filter((i) => i.status === "active").map((i) => ({ name: i.name, variant: i.variant, quantity: i.quantity, amount: round2(i.price * i.quantity) })),
          upi: s.upiId && due > 0 ? upiLink(s.upiId, s.restaurantName, due, s.currency, `Bill ${order.billNumber}`) : null,
        },
      });
    });
  } catch (error) {
    return handleError(error);
  }
}
