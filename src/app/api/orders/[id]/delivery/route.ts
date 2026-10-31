import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { loadOrder, serializeOrder } from "@/lib/orders";

const schema = z.object({
  riderName: z.string().trim().max(40).nullable().optional(),
  // out = left with the rider, delivered = handed to the customer, null = back to the restaurant
  status: z.enum(["out", "delivered"]).nullable().optional(),
});

/** Who takes a delivery order out, and when it left and arrived. Works before and after payment. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const order = await loadOrder(id);
    if (order.type !== "delivery") fail("Only delivery orders have a rider.");
    if (order.status === "cancelled") fail("This order was cancelled.");
    const rider = body.riderName !== undefined ? body.riderName || null : order.riderName;
    // A rider is optional: small restaurants often send whoever is free without noting it.
    const now = new Date();
    await prisma.order.update({
      where: { id },
      data: {
        riderName: rider,
        ...(body.status !== undefined && {
          deliveryStatus: body.status,
          ...(body.status === "out" && { outAt: now, deliveredAt: null }),
          ...(body.status === "delivered" && { deliveredAt: now, outAt: order.outAt ?? now }),
          ...(body.status === null && { outAt: null, deliveredAt: null }),
        }),
      },
    });
    const updated = await loadOrder(id);
    if (body.status === "out") await logActivity(user, "Out for delivery", `Order #${order.number}${rider ? ` with ${rider}` : ""}`);
    else if (body.status === "delivered") await logActivity(user, "Delivered", `Order #${order.number}${rider ? ` by ${rider}` : ""}`);
    else if (body.riderName !== undefined && rider !== order.riderName) await logActivity(user, "Chose rider", `Order #${order.number}: ${rider ?? "none"}`);
    return NextResponse.json({ order: serializeOrder(updated) });
  });
}
