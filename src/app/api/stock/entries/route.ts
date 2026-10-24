import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { isDateKey, todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { STOCK_ENTRY_TYPES, addStockEntry, round3 } from "@/lib/stock";
import { formatCurrency } from "@/lib/utils";

/** Stock history: newest first, for one item or all, by period and kind. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const sp = new URL(request.url).searchParams;
    const where: Prisma.StockEntryWhereInput = {};
    const item = sp.get("item");
    const type = sp.get("type");
    if (item) where.stockItemId = item;
    if (type && (STOCK_ENTRY_TYPES as readonly string[]).includes(type)) where.type = type;
    const from = sp.get("from");
    const to = sp.get("to");
    if (isDateKey(from) && isDateKey(to)) where.date = { gte: from, lte: to };
    const entries = await prisma.stockEntry.findMany({
      where,
      include: { stockItem: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ entries });
  });
}

const schema = z.object({
  stockItemId: z.string().min(1),
  type: z.enum(["purchase", "wastage", "count"]),
  // purchase / wastage: how much; count: how much is actually there now
  quantity: z.coerce.number().min(0).max(10_000_000),
  cost: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
  supplier: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(200).optional().nullable(),
  // A purchase paid in cash from the till is also saved as an expense.
  paidFromTill: z.boolean().default(false),
});

/** A purchase came in, something was wasted, or the stock was counted. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const item = await prisma.stockItem.findFirst({ where: { id: body.stockItemId } });
    if (!item) fail("Stock item not found", 404);
    if (body.type !== "count" && body.quantity <= 0) fail("Enter how much");
    const date = todayKey(settings.timezone);
    const change = body.type === "purchase" ? body.quantity : body.type === "wastage" ? -body.quantity : round3(body.quantity - item.quantity);

    const entry = await prisma.$transaction(async (tx) => {
      const e = await addStockEntry(tx, {
        stockItemId: item.id,
        type: body.type,
        quantity: change,
        date,
        createdByName: user.name,
        cost: body.type === "purchase" ? (body.cost ?? null) : null,
        supplier: body.type === "purchase" ? body.supplier || null : null,
        note: body.note || null,
      });
      if (body.type === "purchase" && body.cost && body.quantity > 0) {
        await tx.stockItem.update({ where: { id: item.id }, data: { costPerUnit: round2(body.cost / body.quantity) } });
        if (body.paidFromTill) {
          await tx.expense.create({
            data: {
              restaurantId: settings.restaurantId,
              date,
              category: "Groceries",
              amount: round2(body.cost),
              method: "cash",
              paidTo: body.supplier || null,
              notes: `Stock: ${body.quantity} ${item.unit} ${item.name}`,
              createdById: user.id,
              createdByName: user.name,
            },
          });
        }
      }
      return e;
    });
    const what =
      body.type === "purchase"
        ? `Bought ${body.quantity} ${item.unit} ${item.name}${body.cost ? ` for ${formatCurrency(body.cost, settings.currency)}` : ""}`
        : body.type === "wastage"
          ? `Wasted ${body.quantity} ${item.unit} ${item.name}${body.note ? ` (${body.note})` : ""}`
          : `Counted ${item.name}: ${body.quantity} ${item.unit} (${change >= 0 ? "+" : ""}${change})`;
    await logActivity(user, body.type === "purchase" ? "Stock purchase" : body.type === "wastage" ? "Stock wastage" : "Stock count", what);
    return NextResponse.json({ entry }, { status: 201 });
  });
}
