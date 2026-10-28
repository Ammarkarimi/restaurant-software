import { NextRequest, NextResponse } from "next/server";
import { currentRestaurantId, prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { addonGroupSchema, setGroupItems } from "@/lib/menu-server";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const { itemIds, options, ...body } = addonGroupSchema.parse(await request.json());
    const group = await prisma.$transaction(async (tx) => {
      const last = await tx.addonGroup.aggregate({ _max: { sortOrder: true } });
      const created = await tx.addonGroup.create({
        data: { restaurantId: currentRestaurantId(), ...body, options: JSON.stringify(options), sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
      if (itemIds) await setGroupItems(tx, created.id, itemIds);
      return created;
    });
    await logActivity(user, "Added add-on group", `${group.name}: ${options.map((o) => o.name).join(", ")}`);
    return NextResponse.json({ group }, { status: 201 });
  });
}
