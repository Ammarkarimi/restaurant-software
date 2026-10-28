import { NextRequest, NextResponse } from "next/server";
import { currentRestaurantId, prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { priceListData, priceListSchema } from "@/lib/menu-server";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = priceListSchema.parse(await request.json());
    const last = await prisma.priceList.aggregate({ _max: { sortOrder: true } });
    const list = await prisma.priceList.create({ data: { restaurantId: currentRestaurantId(), ...priceListData(body), sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await logActivity(user, "Added special prices", `${list.name}${body.adjustPercent ? ` (${body.adjustPercent > 0 ? "+" : ""}${body.adjustPercent}%)` : ""}`);
    return NextResponse.json({ priceList: list }, { status: 201 });
  });
}
