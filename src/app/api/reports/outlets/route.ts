import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { outletsFor } from "@/lib/auth";
import { diffDays, isDateKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";

/** Sales of every outlet this owner runs, side by side, for one period. */
export async function GET(request: NextRequest) {
  return withAdmin(async (user) => {
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    if (!isDateKey(from) || !isDateKey(to) || to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    const outlets = await outletsFor(user.id);
    if (outlets.length < 2) return NextResponse.json({ outlets: [] });
    const ids = outlets.map((o) => o.id);
    const [sales, expenses] = await Promise.all([
      rawPrisma.order.groupBy({
        by: ["restaurantId"],
        where: { restaurantId: { in: ids }, status: "settled", businessDate: { gte: from, lte: to } },
        _sum: { total: true, guests: true },
        _count: { _all: true },
      }),
      rawPrisma.expense.groupBy({ by: ["restaurantId"], where: { restaurantId: { in: ids }, date: { gte: from, lte: to } }, _sum: { amount: true } }),
    ]);
    return NextResponse.json({
      outlets: outlets.map((o) => {
        const s = sales.find((x) => x.restaurantId === o.id);
        const bills = s?._count._all ?? 0;
        const total = round2(s?._sum.total ?? 0);
        return {
          ...o,
          current: o.id === user.restaurantId,
          sales: total,
          bills,
          guests: s?._sum.guests ?? 0,
          averageBill: bills ? round2(total / bills) : 0,
          expenses: round2(expenses.find((x) => x.restaurantId === o.id)?._sum.amount ?? 0),
        };
      }),
    });
  });
}
