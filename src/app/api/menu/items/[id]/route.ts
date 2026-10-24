import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/utils";
import { menuItemData, menuItemSchema } from "@/lib/menu-server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = menuItemSchema.parse(await request.json());
    const item = await prisma.menuItem.findFirst({ where: { id } });
    if (!item) fail("Menu item not found", 404);
    if (!(await prisma.menuCategory.findFirst({ where: { id: body.categoryId } }))) fail("Choose a category for this item");
    const data = menuItemData(body);
    const updated = await prisma.menuItem.update({ where: { id }, data });
    const changes = [
      item.name !== data.name && `name ${item.name} → ${data.name}`,
      item.price !== data.price && `price ${formatCurrency(item.price)} → ${formatCurrency(data.price)}`,
      item.variants !== data.variants && "portions changed",
    ].filter(Boolean);
    await logActivity(user, "Edited menu item", `${updated.name}${changes.length ? `: ${changes.join(", ")}` : ""}`);
    return NextResponse.json({ item: updated });
  });
}

/** The "available today" switch. Cashiers can use it too, when the kitchen runs out. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const { available } = z.object({ available: z.boolean() }).parse(await request.json());
    const item = await prisma.menuItem.findFirst({ where: { id } });
    if (!item) fail("Menu item not found", 404);
    const updated = await prisma.menuItem.update({ where: { id }, data: { available } });
    await logActivity(user, available ? "Marked item available" : "Marked item sold out", item.name);
    return NextResponse.json({ item: updated });
  }, { kitchen: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const item = await prisma.menuItem.findFirst({ where: { id } });
    if (!item) fail("Menu item not found", 404);
    // Old bills keep their own copy of the name and price, so deleting is safe.
    await prisma.menuItem.delete({ where: { id } });
    await logActivity(user, "Deleted menu item", item.name);
    return NextResponse.json({ success: true });
  });
}
