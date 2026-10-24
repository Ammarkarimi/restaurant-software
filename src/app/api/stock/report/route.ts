import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { csvResponse, fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, diffDays, isDateKey, todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { round3 } from "@/lib/stock";

/** Per stock item for a period: opening, bought, used by bills, wasted, counted differences, closing. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const sp = new URL(request.url).searchParams;
    const settings = await getSettings();
    const to = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey(settings.timezone);
    const from = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(to, -6);
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");

    const [items, entries, later] = await Promise.all([
      prisma.stockItem.findMany({ orderBy: { name: "asc" } }),
      prisma.stockEntry.findMany({ where: { date: { gte: from, lte: to } }, select: { stockItemId: true, type: true, quantity: true, cost: true } }),
      prisma.stockEntry.groupBy({ by: ["stockItemId"], where: { date: { gt: to } }, _sum: { quantity: true } }),
    ]);
    const afterTo = new Map(later.map((l) => [l.stockItemId, l._sum.quantity ?? 0]));
    const rows = items.map((i) => {
      const mine = entries.filter((e) => e.stockItemId === i.id);
      const sum = (types: string[]) => round3(mine.filter((e) => types.includes(e.type)).reduce((s, e) => s + e.quantity, 0));
      const closing = round3(i.quantity - (afterTo.get(i.id) ?? 0));
      const change = round3(mine.reduce((s, e) => s + e.quantity, 0));
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        opening: round3(closing - change),
        purchased: sum(["purchase"]),
        used: round3(-sum(["used", "returned"])),
        wasted: round3(-sum(["wastage"])),
        adjusted: sum(["count"]),
        closing,
        purchaseCost: round2(mine.filter((e) => e.type === "purchase").reduce((s, e) => s + (e.cost ?? 0), 0)),
        usedValue: round2(-sum(["used", "returned"]) * i.costPerUnit),
      };
    });
    const active = rows.filter((r) => r.purchased || r.used || r.wasted || r.adjusted || r.closing);

    if (sp.get("format") === "csv") {
      return csvResponse(`stock_${from}_to_${to}.csv`, [
        ["Item", "Unit", "Opening", "Bought", "Used in bills", "Wasted", "Count difference", "Closing", "Purchase cost", "Value used"],
        ...active.map((r) => [r.name, r.unit, r.opening, r.purchased, r.used, r.wasted, r.adjusted, r.closing, r.purchaseCost, r.usedValue]),
      ]);
    }
    return NextResponse.json({
      from,
      to,
      rows: active,
      totals: { purchaseCost: round2(active.reduce((s, r) => s + r.purchaseCost, 0)), usedValue: round2(active.reduce((s, r) => s + r.usedValue, 0)) },
    });
  });
}
