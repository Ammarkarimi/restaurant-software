import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, rawPrisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyBillShareToken } from "@/lib/share";

const stars = z.coerce.number().int().min(1).max(5);
const schema = z.object({
  token: z.string().min(10).max(80),
  rating: stars,
  food: stars.nullable().optional(),
  service: stars.nullable().optional(),
  ambience: stars.nullable().optional(),
  comment: z.string().trim().max(1000).nullable().optional(),
});

/** A guest rates their visit from the bill link on WhatsApp. One rating per bill; sending again updates it. */
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`feedback:${clientIp(request.headers)}`, 10, 60 * 60_000)) fail("Thank you! We already have your feedback.", 429);
    const body = schema.parse(await request.json());
    const orderId = verifyBillShareToken(body.token);
    if (!orderId) fail("This link is not valid", 404);
    const order = await rawPrisma.order.findUnique({ where: { id: orderId }, select: { id: true, restaurantId: true, status: true, customerId: true, customerName: true, customerPhone: true, restaurant: { select: { status: true } } } });
    if (!order || order.status !== "settled" || order.restaurant.status !== "active") fail("This bill cannot be rated", 404);
    return await runForRestaurant(order.restaurantId, async () => {
      const data = {
        rating: body.rating,
        food: body.food ?? null,
        service: body.service ?? null,
        ambience: body.ambience ?? null,
        comment: body.comment || null,
      };
      await prisma.feedback.upsert({
        where: { orderId: order.id, restaurantId: order.restaurantId },
        create: { restaurantId: order.restaurantId, orderId: order.id, customerId: order.customerId, name: order.customerName, phone: order.customerPhone, ...data },
        update: data,
      });
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return handleError(error);
  }
}
