import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { ACTIVE_STATUSES, orderInclude, totalsOf } from "@/lib/orders";
import { round2 } from "@/lib/billing";
import { isAdmin } from "@/lib/api";
import { isLow } from "@/lib/stock";

/** Everything the Tables screen needs: the floor, running orders and today's numbers. */
export async function GET() {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const [tables, running, todayOrders, stock] = await Promise.all([
      prisma.diningTable.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.order.findMany({ where: { status: { in: ACTIVE_STATUSES } }, include: orderInclude, orderBy: { createdAt: "asc" } }),
      prisma.order.findMany({ where: { status: "settled", businessDate: today }, select: { total: true, guests: true } }),
      isAdmin(user) ? prisma.stockItem.findMany({ where: { active: true, lowAt: { not: null } }, select: { name: true, quantity: true, lowAt: true } }) : [],
    ]);
    const lowStock = stock.filter(isLow).map((s) => s.name);

    const summaries = running.map((o) => {
      const t = totalsOf(o);
      return {
        id: o.id,
        number: o.number,
        type: o.type,
        source: o.source,
        sourceRef: o.sourceRef,
        status: o.status,
        tableId: o.activeTableId,
        // A separate (split) bill of a table that still has its main order running.
        splitOf: o.activeTableId ? null : (o.table?.name ?? null),
        customerName: o.customerName,
        guests: o.guests,
        createdAt: o.createdAt,
        billNumber: o.billNumber,
        total: t.total,
        itemCount: t.itemCount,
        unsent: o.items.filter((i) => i.status === "active" && i.kotNumber === null).length,
        // Dishes a guest ordered from the table QR code, waiting for staff to check them.
        guestNew: o.items.filter((i) => i.status === "active" && i.kotNumber === null && i.byGuest).length,
        // Dishes the kitchen marked ready that are not served yet.
        ready: o.items.filter((i) => i.status === "active" && i.kotNumber !== null && i.kitchenStatus === "ready").length,
      };
    });
    const byTable = new Map(summaries.filter((s) => s.tableId).map((s) => [s.tableId!, s]));
    const extraBills = new Map<string, number>();
    for (const o of running) if (!o.activeTableId && o.tableId) extraBills.set(o.tableId, (extraBills.get(o.tableId) ?? 0) + 1);

    return NextResponse.json({
      today,
      tables: tables.map((t) => ({ ...t, order: byTable.get(t.id) ?? null, extraBills: extraBills.get(t.id) ?? 0 })),
      otherOrders: summaries.filter((s) => !s.tableId),
      stats: {
        sales: round2(todayOrders.reduce((sum, o) => sum + o.total, 0)),
        bills: todayOrders.length,
        guests: todayOrders.reduce((sum, o) => sum + o.guests, 0),
        running: summaries.length,
        runningValue: round2(summaries.reduce((sum, o) => sum + o.total, 0)),
      },
      lowStock,
    });
  });
}
