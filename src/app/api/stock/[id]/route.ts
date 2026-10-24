import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isUniqueViolation } from "@/lib/orders";
import { STOCK_UNITS } from "@/lib/stock";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    unit: z.enum(STOCK_UNITS),
    lowAt: z.coerce.number().min(0).max(10_000_000).nullable(),
    costPerUnit: z.coerce.number().min(0).max(10_000_000),
    active: z.boolean(),
  })
  .partial();

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const item = await prisma.stockItem.findFirst({ where: { id } });
    if (!item) fail("Stock item not found", 404);
    try {
      const updated = await prisma.stockItem.update({ where: { id }, data: body });
      await logActivity(user, "Edited stock item", updated.name);
      return NextResponse.json({ item: updated });
    } catch (error) {
      if (isUniqueViolation(error)) fail(`${body.name} is already in your stock list`);
      throw error;
    }
  });
}

/** Removes a stock item with its history and recipe lines. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const item = await prisma.stockItem.findFirst({ where: { id } });
    if (!item) fail("Stock item not found", 404);
    await prisma.stockItem.delete({ where: { id } });
    await logActivity(user, "Deleted stock item", item.name);
    return NextResponse.json({ success: true });
  });
}
