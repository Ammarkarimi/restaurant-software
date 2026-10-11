import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import {
  ACTIVE_STATUSES,
  buildLines,
  isUniqueViolation,
  itemSummary,
  loadOrder,
  newItemSchema,
  nextNumber,
  orderInclude,
  orderRulesFrom,
  saveTotals,
  sendUnsentToKitchen,
  serializeOrder,
  totalsOf,
} from "@/lib/orders";
import { isDateKey } from "@/lib/dates";
import { ORDER_STATUSES, ORDER_TYPES } from "@/lib/utils";

/** Bills list: by business day (paid / cancelled) or start day (running), status and search. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    const q = sp.get("q")?.trim();
    const from = sp.get("from");
    const to = sp.get("to");
    const settings = await getSettings();

    const where: Prisma.OrderWhereInput = {};
    const range = isDateKey(from) && isDateKey(to) ? { gte: from, lte: to } : null;
    if (status === "running") {
      where.status = { in: ACTIVE_STATUSES };
    } else if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
      if (range && !ACTIVE_STATUSES.includes(status)) where.businessDate = range;
    } else if (range) {
      // Paid and cancelled orders have a business day; running ones are always shown.
      where.OR = [{ businessDate: range }, { status: { in: ACTIVE_STATUSES } }];
    }
    if (q) {
      const n = Number(q.replace(/^#/, ""));
      const search: Prisma.OrderWhereInput[] = [
        { billNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        { table: { name: { equals: q, mode: "insensitive" } } },
      ];
      if (Number.isInteger(n) && n > 0) search.push({ number: n });
      where.AND = [{ OR: search }];
    }

    const orders = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const rows = orders.map((o) => {
      const t = totalsOf(o);
      return {
        id: o.id,
        number: o.number,
        billNumber: o.billNumber,
        type: o.type,
        status: o.status,
        table: o.table,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        createdAt: o.createdAt,
        settledAt: o.settledAt,
        createdByName: o.createdByName,
        itemCount: t.itemCount,
        total: t.total,
        methods: [...new Set(o.payments.map((p) => p.method))],
        cancelReason: o.cancelReason,
      };
    });
    return NextResponse.json({ orders: rows, timezone: settings.timezone });
  });
}

const createSchema = z.object({
  type: z.enum(ORDER_TYPES),
  tableId: z.string().optional().nullable(),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  customerAddress: z.string().trim().max(300).optional().nullable(),
  guests: z.coerce.number().int().min(0).max(500).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(newItemSchema).max(200).default([]),
  sendToKitchen: z.boolean().default(false),
});

/** Opens a new order, usually with its first items. A table can only have one running order. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = createSchema.parse(await request.json());
    const settings = await getSettings();
    if (body.type === "dine_in" && !body.tableId) fail("Choose a table for a dine-in order");

    try {
      const result = await prisma.$transaction(async (tx) => {
        let tableId: string | null = null;
        if (body.type === "dine_in") {
          const table = await tx.diningTable.findFirst({ where: { id: body.tableId!, active: true } });
          if (!table) fail("This table was not found");
          tableId = table.id;
        }
        const lines = await buildLines(tx, body.items, settings);
        const created = await tx.order.create({
          data: {
            restaurantId: settings.restaurantId,
            number: await nextNumber(tx, "orderSeq"),
            type: body.type,
            tableId,
            activeTableId: tableId,
            customerName: body.customerName || null,
            customerPhone: body.customerPhone || null,
            customerAddress: body.customerAddress || null,
            guests: body.guests,
            notes: body.notes || null,
            createdById: user.id,
            createdByName: user.name,
            ...orderRulesFrom(settings),
            items: { create: lines.map((l) => ({ ...l, restaurantId: settings.restaurantId })) },
          },
        });
        const kotNumber = body.sendToKitchen ? await sendUnsentToKitchen(tx, created.id) : null;
        const order = await saveTotals(tx, await loadOrder(created.id, tx));
        return { order, kotNumber };
      });
      const where = result.order.table ? `table ${result.order.table.name}` : result.order.type.replace("_", " ");
      await logActivity(user, "Opened order", `#${result.order.number} for ${where}${lines(body.items.length)}`);
      if (result.kotNumber) await logActivity(user, "Sent to kitchen", `KOT ${result.kotNumber} for order #${result.order.number}: ${itemSummary(result.order.items)}`);
      return NextResponse.json({ order: serializeOrder(result.order), kotNumber: result.kotNumber }, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error, "activeTableId")) {
        fail("This table already has a running order. Go back to Tables and open it.", 409);
      }
      throw error;
    }
  });
}

function lines(n: number) {
  return n ? ` with ${n} item${n > 1 ? "s" : ""}` : "";
}
