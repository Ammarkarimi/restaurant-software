import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { parseVariants } from "@/lib/menu";

type Params = { params: Promise<{ menuItemId: string }> };

const schema = z.object({
  lines: z
    .array(
      z.object({
        stockItemId: z.string().min(1, "Choose a stock item"),
        variant: z.string().trim().max(40).nullable().optional(),
        quantity: z.coerce.number().positive("Enter how much one dish uses").max(100_000),
      })
    )
    .max(40),
});

/** Replaces what one dish uses from stock. */
export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { menuItemId } = await params;
    const body = schema.parse(await request.json());
    const dish = await prisma.menuItem.findFirst({ where: { id: menuItemId } });
    if (!dish) fail("Dish not found", 404);
    const portions = parseVariants(dish.variants).map((v) => v.name);
    const stockIds = [...new Set(body.lines.map((l) => l.stockItemId))];
    const found = await prisma.stockItem.count({ where: { id: { in: stockIds } } });
    if (found !== stockIds.length) fail("A stock item on this recipe was not found");
    for (const l of body.lines) if (l.variant && !portions.includes(l.variant)) fail(`${dish.name} has no portion called ${l.variant}`);

    await prisma.$transaction(async (tx) => {
      await tx.recipeLine.deleteMany({ where: { menuItemId } });
      if (body.lines.length) {
        await tx.recipeLine.createMany({
          data: body.lines.map((l) => ({ restaurantId: dish.restaurantId, menuItemId, stockItemId: l.stockItemId, variant: l.variant || null, quantity: l.quantity })),
        });
      }
    });
    await logActivity(user, "Changed recipe", `${dish.name}: ${body.lines.length} ingredient(s)`);
    return NextResponse.json({ success: true });
  });
}
