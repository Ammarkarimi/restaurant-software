import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import type { DisplayToken } from "@/lib/types";

/**
 * Takeaway and delivery orders for the token screen outside the kitchen: "preparing" while any
 * dish sent to the kitchen is still cooking, "ready" when all are ready and not yet handed over.
 */
export async function GET() {
  return withAuth(
    async () => {
      const since = new Date(Date.now() - 12 * 3600_000);
      const orders = await prisma.order.findMany({
        where: { type: { not: "dine_in" }, status: { not: "cancelled" }, createdAt: { gte: since }, items: { some: { kotNumber: { not: null }, status: "active", kitchenStatus: { in: ["new", "ready"] } } } },
        select: { id: true, number: true, type: true, source: true, sourceRef: true, customerName: true, items: { where: { kotNumber: { not: null }, status: "active" }, select: { kitchenStatus: true, readyAt: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
      const readyCutoff = Date.now() - 45 * 60_000; // ready tokens disappear after 45 minutes
      const tokens: DisplayToken[] = orders.flatMap((o) => {
        const cooking = o.items.some((i) => i.kitchenStatus === "new");
        const readyAt = o.items.reduce<Date | null>((latest, i) => (i.readyAt && (!latest || i.readyAt > latest) ? i.readyAt : latest), null);
        if (!cooking && readyAt && readyAt.getTime() < readyCutoff) return [];
        return [{ orderId: o.id, token: o.number, type: o.type, source: o.source, sourceRef: o.sourceRef, name: o.customerName, status: cooking ? "preparing" : "ready", readyAt: readyAt?.toISOString() ?? null }];
      });
      return NextResponse.json({ tokens });
    },
    { kitchen: true }
  );
}
