import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isUniqueViolation } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    name: z.string().trim().min(1, "Table name is required").max(30),
    area: z.string().trim().min(1).max(40),
    seats: z.coerce.number().int().min(1).max(100),
    sortOrder: z.coerce.number().int(),
    active: z.boolean(),
  })
  .partial();

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const table = await prisma.diningTable.findFirst({ where: { id } });
    if (!table) fail("Table not found", 404);
    try {
      const updated = await prisma.diningTable.update({ where: { id }, data: body });
      if (body.name && body.name !== table.name) await logActivity(user, "Renamed table", `${table.name} → ${body.name}`);
      return NextResponse.json({ table: updated });
    } catch (error) {
      if (isUniqueViolation(error)) fail(`A table called ${body.name} already exists`);
      throw error;
    }
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const table = await prisma.diningTable.findFirst({ where: { id }, include: { activeOrder: true, _count: { select: { orders: true } } } });
    if (!table) fail("Table not found", 404);
    if (table.activeOrder) fail(`${table.name} has a running order. Finish or move it first.`);
    if (table._count.orders > 0) {
      // Keep old bills pointing at the table name; just hide it from the floor.
      await prisma.diningTable.update({ where: { id }, data: { active: false } });
      await logActivity(user, "Hid table", table.name);
      return NextResponse.json({ hidden: true });
    }
    await prisma.diningTable.delete({ where: { id } });
    await logActivity(user, "Deleted table", table.name);
    return NextResponse.json({ deleted: true });
  });
}
