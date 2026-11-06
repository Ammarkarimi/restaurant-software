import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { banquetHallSchema } from "@/lib/banquet";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = banquetHallSchema.parse(await request.json());
    const settings = await getSettings();
    const last = await prisma.banquetHall.aggregate({ _max: { sortOrder: true } });
    const hall = await prisma.banquetHall.create({ data: { restaurantId: settings.restaurantId, ...body, notes: body.notes || null, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await logActivity(user, "Added banquet hall", `${hall.name} (${hall.capacity} guests)`);
    return NextResponse.json({ hall }, { status: 201 });
  });
}
