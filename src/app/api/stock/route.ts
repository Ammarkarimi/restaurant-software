import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { isUniqueViolation } from "@/lib/orders";
import { STOCK_UNITS, addStockEntry, isLow, round3, stockValue } from "@/lib/stock";

/** Everything in stock, with low-stock warnings and the stock value. */
export async function GET() {
  return withAdmin(async () => {
    const items = await prisma.stockItem.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { recipeLines: true } } } });
    return NextResponse.json({
      items: items.map(({ _count, ...i }) => ({ ...i, low: i.active && isLow(i), usedIn: _count.recipeLines })),
      stats: { count: items.filter((i) => i.active).length, low: items.filter((i) => i.active && isLow(i)).length, value: stockValue(items) },
    });
  });
}

const stockItemFields = {
  name: z.string().trim().min(1, "Name is required").max(80),
  unit: z.enum(STOCK_UNITS),
  lowAt: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  costPerUnit: z.coerce.number().min(0).max(10_000_000).default(0),
};

const createSchema = z.object({
  ...stockItemFields,
  quantity: z.coerce.number().min(0).max(10_000_000).default(0), // opening stock
});

/** Adds one stock item, or many at once (`items`) when setting up. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const raw = await request.json();
    const list = z.array(createSchema).min(1).max(300).parse(Array.isArray(raw?.items) ? raw.items : [raw]);
    const settings = await getSettings();
    const existing = new Set((await prisma.stockItem.findMany({ select: { name: true } })).map((i) => i.name.toLowerCase()));
    const fresh = list.filter((i) => !existing.has(i.name.toLowerCase()));
    if (fresh.length === 0) fail(list.length === 1 ? `${list[0].name} is already in your stock list` : "All of these are already in your stock list");
    try {
      await prisma.$transaction(async (tx) => {
        for (const i of fresh) {
          const item = await tx.stockItem.create({ data: { restaurantId: settings.restaurantId, name: i.name, unit: i.unit, lowAt: i.lowAt ?? null, costPerUnit: i.costPerUnit } });
          if (i.quantity > 0) {
            await addStockEntry(tx, { stockItemId: item.id, type: "count", quantity: round3(i.quantity), date: todayKey(settings.timezone), createdByName: user.name, note: "Opening stock" });
          }
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) fail("Two items have the same name");
      throw error;
    }
    await logActivity(user, fresh.length === 1 ? "Added stock item" : "Added stock items", fresh.map((i) => i.name).join(", "));
    return NextResponse.json({ added: fresh.length, skipped: list.length - fresh.length }, { status: 201 });
  });
}
