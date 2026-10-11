import { NextRequest, NextResponse } from "next/server";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { menuItemData, menuItemSchema } from "@/lib/menu-server";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = menuItemSchema.parse(await request.json());
    const category = await prisma.menuCategory.findFirst({ where: { id: body.categoryId } });
    if (!category) fail("Choose a category for this item");
    const last = await prisma.menuItem.aggregate({ where: { categoryId: category.id }, _max: { sortOrder: true } });
    const item = await prisma.menuItem.create({ data: { restaurantId: currentRestaurantId(), ...menuItemData(body), sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await logActivity(user, "Added menu item", `${item.name} in ${category.name}`);
    return NextResponse.json({ item }, { status: 201 });
  });
}
