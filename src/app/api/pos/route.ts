import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { ACTIVE_STATUSES, orderInclude, totalsOf } from "@/lib/orders";
import { round2 } from "@/lib/billing";

/** Everything the Tables screen needs: the floor, running orders and today's numbers. */
export async function GET() {
  return withAuth(async () => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const [tables, running, todayOrders] = await Promise.all([
      prisma.diningTable.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.order.findMany({ where: { status: { in: ACTIVE_STATUSES } }, include: orderInclude, orderBy: { createdAt: "asc" } }),
      prisma.order.findMany({ where: { status: "settled", businessDate: today }, select: { total: true, guests: true } }),
    ]);

    const summaries = running.map((o) => {
      const t = totalsOf(o);
      return {
        id: o.id,
        number: o.number,
        type: o.type,
        status: o.status,
        tableId: o.activeTableId,
        customerName: o.customerName,
        guests: o.guests,
        createdAt: o.createdAt,
        billNumber: o.billNumber,
        total: t.total,
        itemCount: t.itemCount,
        unsent: o.items.filter((i) => i.status === "active" && i.kotNumber === null).length,
      };
    });
    const byTable = new Map(summaries.filter((s) => s.tableId).map((s) => [s.tableId!, s]));

    return NextResponse.json({
      today,
      tables: tables.map((t) => ({ ...t, order: byTable.get(t.id) ?? null })),
      otherOrders: summaries.filter((s) => !s.tableId),
      stats: {
        sales: round2(todayOrders.reduce((sum, o) => sum + o.total, 0)),
        bills: todayOrders.length,
        guests: todayOrders.reduce((sum, o) => sum + o.guests, 0),
        running: summaries.length,
        runningValue: round2(summaries.reduce((sum, o) => sum + o.total, 0)),
      },
    });
  });
}
