import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { addonGroupSchema, setGroupItems } from "@/lib/menu-server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const { itemIds, options, ...body } = addonGroupSchema.parse(await request.json());
    const existing = await prisma.addonGroup.findFirst({ where: { id } });
    if (!existing) fail("Add-on group not found", 404);
    const group = await prisma.$transaction(async (tx) => {
      const updated = await tx.addonGroup.update({ where: { id }, data: { ...body, options: JSON.stringify(options) } });
      if (itemIds) await setGroupItems(tx, id, itemIds);
      return updated;
    });
    await logActivity(user, "Edited add-on group", `${group.name}: ${options.map((o) => o.name).join(", ")}`);
    return NextResponse.json({ group });
  });
}

/** Old bills keep their own copy of the add-ons, so deleting a group is safe. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const existing = await prisma.addonGroup.findFirst({ where: { id } });
    if (!existing) fail("Add-on group not found", 404);
    await prisma.$transaction(async (tx) => {
      await setGroupItems(tx, id, []);
      await tx.addonGroup.delete({ where: { id } });
    });
    await logActivity(user, "Deleted add-on group", existing.name);
    return NextResponse.json({ success: true });
  });
}
