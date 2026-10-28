import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { nextNumber } from "@/lib/orders";
import { linesTotal, purchaseLineSchema } from "@/lib/purchases";
import { formatCurrency } from "@/lib/utils";

/** Purchase orders, newest first. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const status = new URL(request.url).searchParams.get("status");
    const purchases = await prisma.purchase.findMany({
      where: status && ["ordered", "received", "cancelled"].includes(status) ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ purchases });
  });
}

const schema = z.object({
  supplierId: z.string().max(40).nullable().optional(),
  supplierName: z.string().trim().max(80).optional(),
  lines: z.array(purchaseLineSchema).min(1, "Add at least one item").max(100),
  notes: z.string().trim().max(300).nullable().optional(),
});

/** A new purchase order to send to a supplier. Stock changes only when it is received. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const supplier = body.supplierId ? await prisma.supplier.findFirst({ where: { id: body.supplierId } }) : null;
    if (body.supplierId && !supplier) fail("Supplier not found");
    const name = supplier?.name ?? body.supplierName?.trim();
    if (!name) fail("Choose the supplier");
    const items = await prisma.stockItem.findMany({ where: { id: { in: body.lines.map((l) => l.stockItemId) } } });
    const lines = body.lines.map((l) => {
      const item = items.find((i) => i.id === l.stockItemId);
      if (!item) fail("A stock item on this order was not found");
      return { stockItemId: item.id, name: item.name, unit: item.unit, quantity: l.quantity, rate: l.rate || item.costPerUnit };
    });
    const purchase = await prisma.$transaction(async (tx) =>
      tx.purchase.create({
        data: {
          restaurantId: settings.restaurantId,
          number: await nextNumber(tx, "purchaseSeq"),
          supplierId: supplier?.id ?? null,
          supplierName: name,
          orderedOn: todayKey(settings.timezone),
          lines: JSON.stringify(lines),
          total: linesTotal(lines),
          notes: body.notes || null,
          createdByName: user.name,
        },
      })
    );
    await logActivity(user, "Purchase order", `#${purchase.number} to ${name}: ${lines.length} item(s), about ${formatCurrency(purchase.total, settings.currency)}`);
    return NextResponse.json({ purchase }, { status: 201 });
  });
}
