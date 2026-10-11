import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { parseQuickAdd } from "@/lib/menu";

const schema = z.object({
  text: z.string().max(100_000),
  defaultCategory: z.string().trim().min(1).max(60).default("Main course"),
  dryRun: z.boolean().default(false),
});

/** Quick add: many items pasted as lines of "name, price, category, veg/non-veg, code". */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    const { rows, errors } = parseQuickAdd(body.text, body.defaultCategory);
    if (rows.length > 500) fail("Add at most 500 items at a time");
    if (body.dryRun || rows.length === 0) return NextResponse.json({ rows, errors, added: 0 });

    const restaurantId = currentRestaurantId();
    const added = await prisma.$transaction(async (tx) => {
      const categories = await tx.menuCategory.findMany();
      const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
      let catOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0);
      let itemOrder = (await tx.menuItem.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
      for (const row of rows) {
        let category = byName.get(row.category.toLowerCase());
        if (!category) {
          category = await tx.menuCategory.create({ data: { restaurantId, name: row.category, sortOrder: ++catOrder } });
          byName.set(row.category.toLowerCase(), category);
        }
        await tx.menuItem.create({
          data: {
            restaurantId,
            categoryId: category.id,
            name: row.name,
            price: row.price,
            foodType: row.foodType,
            shortCode: row.shortCode ?? null,
            sortOrder: ++itemOrder,
          },
        });
      }
      return rows.length;
    });
    await logActivity(user, "Quick-added menu items", `${added} items`);
    return NextResponse.json({ rows, errors, added }, { status: 201 });
  });
}
