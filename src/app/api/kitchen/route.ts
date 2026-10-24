import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { ACTIVE_STATUSES } from "@/lib/orders";
import type { KitchenTicket } from "@/lib/types";

/** Kitchen tickets still to cook or waiting to be served, oldest first. */
export async function GET() {
  return withAuth(
    async () => {
      const items = await prisma.orderItem.findMany({
        where: { kotNumber: { not: null }, kitchenStatus: { in: ["new", "ready"] }, order: { status: { in: ACTIVE_STATUSES } } },
        include: { order: { select: { id: true, number: true, type: true, source: true, sourceRef: true, customerName: true, notes: true, table: { select: { name: true } } } } },
        orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
        take: 2000,
      });
      const tickets = new Map<string, KitchenTicket>();
      for (const i of items) {
        const key = `${i.orderId}-${i.kotNumber}`;
        let t = tickets.get(key);
        if (!t) {
          t = {
            key,
            kotNumber: i.kotNumber!,
            orderId: i.order.id,
            orderNumber: i.order.number,
            type: i.order.type,
            source: i.order.source,
            sourceRef: i.order.sourceRef,
            table: i.order.table?.name ?? null,
            customerName: i.order.customerName,
            notes: i.order.notes,
            sentAt: (i.sentAt ?? i.createdAt).toISOString(),
            status: "ready",
            items: [],
          };
          tickets.set(key, t);
        }
        t.items.push({ id: i.id, name: i.name, variant: i.variant, quantity: i.quantity, note: i.note, cancelled: i.status === "cancelled", kitchenStatus: i.kitchenStatus });
      }
      // A ticket is cooking while any of its dishes is; cancelled-only tickets are not shown.
      const list = [...tickets.values()].filter((t) => t.items.some((i) => !i.cancelled));
      for (const t of list) if (t.items.some((i) => !i.cancelled && i.kitchenStatus === "new")) t.status = "new";
      return NextResponse.json({ tickets: list, now: new Date().toISOString() });
    },
    { kitchen: true }
  );
}

const schema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(500),
  status: z.enum(["new", "ready", "served"]),
});

/** The kitchen marks dishes ready; the waiter (or kitchen) marks them served. */
export async function PATCH(request: NextRequest) {
  return withAuth(
    async () => {
      const body = schema.parse(await request.json());
      const result = await prisma.orderItem.updateMany({
        where: { id: { in: body.itemIds }, kotNumber: { not: null } },
        data: { kitchenStatus: body.status, readyAt: body.status === "new" ? null : body.status === "ready" ? new Date() : undefined },
      });
      return NextResponse.json({ updated: result.count });
    },
    { kitchen: true }
  );
}
