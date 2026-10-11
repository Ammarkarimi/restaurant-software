import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { withPlatform } from "@/lib/platform";
import { platformRestaurantDetail } from "@/lib/platform-restaurants";

/** Removes a subscription payment recorded by mistake. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withPlatform(async () => {
    const { id } = await params;
    const payment = await rawPrisma.subscriptionPayment.findUnique({ where: { id } });
    if (!payment) fail("Payment not found", 404);
    await rawPrisma.subscriptionPayment.delete({ where: { id } });
    return NextResponse.json(await platformRestaurantDetail(payment.restaurantId));
  });
}
