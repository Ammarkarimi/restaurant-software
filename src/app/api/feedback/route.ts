import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";

/** Guest ratings, newest first, with averages. "low" = 1 or 2 stars, to call back. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const filter = new URL(request.url).searchParams.get("filter");
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [feedback, all, recent] = await Promise.all([
      prisma.feedback.findMany({ where: filter === "low" ? { rating: { lte: 2 } } : {}, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.feedback.aggregate({ _avg: { rating: true, food: true, service: true, ambience: true }, _count: true }),
      prisma.feedback.groupBy({ by: ["rating"], where: { createdAt: { gte: since } }, _count: true }),
    ]);
    const orders = await prisma.order.findMany({ where: { id: { in: feedback.map((f) => f.orderId) } }, select: { id: true, billNumber: true, total: true, table: { select: { name: true } }, type: true } });
    const byId = new Map(orders.map((o) => [o.id, o]));
    return NextResponse.json({
      feedback: feedback.map((f) => ({ ...f, order: byId.get(f.orderId) ?? null })),
      stats: {
        count: all._count,
        rating: all._avg.rating,
        food: all._avg.food,
        service: all._avg.service,
        ambience: all._avg.ambience,
        last30: Object.fromEntries(recent.map((r) => [r.rating, r._count])),
        toCallBack: await prisma.feedback.count({ where: { rating: { lte: 2 }, followedUp: false } }),
      },
    });
  });
}
