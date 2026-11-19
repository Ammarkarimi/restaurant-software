import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, todayKey } from "@/lib/dates";
import { isLow, reorderQuantity, round3 } from "@/lib/stock";

/**
 * What to buy: items at or below their warning level (or that will be within ?days, default 7, at
 * the last two weeks' pace), how much, and who sold it last.
 */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const settings = await getSettings();
    const days = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));
    const today = todayKey(settings.timezone);
    const since = addDays(today, -14);
    const [items, used, purchases] = await Promise.all([
      prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.stockEntry.groupBy({ by: ["stockItemId"], where: { type: { in: ["used", "wastage", "transfer_out"] }, date: { gte: since, lt: today } }, _sum: { quantity: true } }),
      prisma.stockEntry.findMany({ where: { type: "purchase", supplier: { not: null } }, orderBy: { createdAt: "desc" }, take: 500, select: { stockItemId: true, supplier: true } }),
    ]);
    const suggestions = items
      .map((item) => {
        const dailyUse = round3(-(used.find((u) => u.stockItemId === item.id)?._sum.quantity ?? 0) / 14);
        const quantity = reorderQuantity(item, dailyUse, days);
        const daysLeft = dailyUse > 0 ? Math.floor(Math.max(0, item.quantity) / dailyUse) : null;
        return { id: item.id, name: item.name, unit: item.unit, inStock: item.quantity, lowAt: item.lowAt, rate: item.costPerUnit, dailyUse, daysLeft, quantity, low: isLow(item), lastSupplier: purchases.find((p) => p.stockItemId === item.id)?.supplier ?? null };
      })
      .filter((s) => s.quantity > 0 && (s.low || (s.daysLeft !== null && s.daysLeft < days)));
    return NextResponse.json({ days, suggestions });
  });
}
