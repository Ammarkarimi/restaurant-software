import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { parseQuickAdd } from "@/lib/menu";
import { importRowSchema, markDuplicates, type ImportRow } from "@/lib/menu-import";

const schema = z.object({
  text: z.string().max(100_000).optional(),
  rows: z.array(importRowSchema).max(1000).optional(),
  defaultCategory: z.string().trim().min(1).max(60).default("Main course"),
  dryRun: z.boolean().default(false),
  source: z.enum(["paste", "excel", "photo"]).default("paste"),
});

/**
 * Adds many dishes at once: pasted lines of "name, price, category, veg/non-veg, code", or rows
 * read from an Excel / CSV file or a menu photo. Dishes already on the menu (same name in the
 * same category) are skipped, so importing the same file twice adds nothing twice.
 */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    let rows: ImportRow[] = body.rows ?? [];
    let errors: string[] = [];
    if (body.text !== undefined) ({ rows, errors } = parseQuickAdd(body.text, body.defaultCategory));
    if (rows.length > 1000) fail("Add at most 1000 dishes at a time");

    const existing = await prisma.menuItem.findMany({ select: { name: true, category: { select: { name: true } } } });
    const marked = markDuplicates(rows, existing.map((e) => ({ name: e.name, category: e.category.name })));
    const fresh = marked.filter((r) => !r.duplicate);
    if (body.dryRun || fresh.length === 0) return NextResponse.json({ rows: marked, errors, added: 0, skipped: marked.length - fresh.length });

    const restaurantId = currentRestaurantId();
    const added = await prisma.$transaction(
      async (tx) => {
        const categories = await tx.menuCategory.findMany();
        const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
        let catOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0);
        let itemOrder = (await tx.menuItem.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
        for (const row of fresh) {
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
              shortCode: row.shortCode || null,
              description: row.description || null,
              variants: JSON.stringify(row.variants ?? []),
              sortOrder: ++itemOrder,
            },
          });
        }
        return fresh.length;
      },
      { timeout: 60_000 }
    );
    const how = { paste: "Quick-added menu items", excel: "Imported menu from Excel", photo: "Imported menu from photo" }[body.source];
    await logActivity(user, how, `${added} items`);
    return NextResponse.json({ rows: marked, errors, added, skipped: marked.length - fresh.length }, { status: 201 });
  });
}
