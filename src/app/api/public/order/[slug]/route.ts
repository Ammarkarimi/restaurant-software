import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findPublicRestaurant, tableForToken } from "@/lib/public-menu";
import { ACTIVE_STATUSES, buildLines, defaultCharges, isUniqueViolation, itemSummary, loadOrder, nextNumber, orderRulesFrom, saveTotals } from "@/lib/orders";

const schema = z.object({
  table: z.string().min(1).max(64),
  name: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1).max(40),
        variant: z.string().trim().max(40).optional().nullable(),
        quantity: z.coerce.number().int().min(1).max(20),
        note: z.string().trim().max(120).optional().nullable(),
      })
    )
    .min(1, "Add something to your order")
    .max(30, "Please order at most 30 different dishes at a time"),
});

/**
 * A guest orders from the QR code on their table. The dishes are added to the table's
 * order as "new" items; staff check them and press "Send to kitchen", so a prank
 * order never reaches the kitchen on its own.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ip = clientIp(request.headers);
    if (!rateLimit(`qr-order:${ip}`, 8, 10 * 60_000)) fail("Too many orders from this phone. Please ask the staff.", 429);
    const body = schema.parse(await request.json());
    const found = await findPublicRestaurant(slug);
    if (!found) fail("This menu is not available", 404);
    if (!found.settings.qrOrderingEnabled) fail("Ordering from the table is switched off. Please order with the staff.", 403);
    if (!rateLimit(`qr-order-table:${slug}:${body.table}`, 15, 10 * 60_000)) fail("Too many orders for this table. Please ask the staff.", 429);

    return await runForRestaurant(found.restaurant.id, async () => {
      const settings = found.settings;
      const table = await tableForToken(body.table);
      if (!table) fail("This QR code is no longer valid. Please ask the staff.", 404);
      const guest = { id: null, name: `Guest at ${table.name}${body.name ? ` (${body.name})` : ""}` };
      try {
        const result = await prisma.$transaction(async (tx) => {
          const lines = (await buildLines(tx, body.items, settings)).map((l) => ({ ...l, byGuest: true }));
          const running = await tx.order.findFirst({ where: { activeTableId: table.id, status: { in: ACTIVE_STATUSES } }, include: { items: true } });
          if (running) {
            const waiting = running.items.filter((i) => i.byGuest && i.kotNumber === null && i.status === "active").length;
            if (waiting + lines.length > 60) fail("Your earlier order is still waiting for the staff. Please ask them.");
            await tx.orderItem.createMany({ data: lines.map((l) => ({ ...l, orderId: running.id, restaurantId: settings.restaurantId })) });
            if (running.status === "billed") await tx.order.update({ where: { id: running.id }, data: { status: "open" } });
            if (!running.customerName && body.name) await tx.order.update({ where: { id: running.id }, data: { customerName: body.name, customerPhone: running.customerPhone ?? (body.phone || null) } });
            return { order: await saveTotals(tx, await loadOrder(running.id, tx)), lines };
          }
          const created = await tx.order.create({
            data: {
              restaurantId: settings.restaurantId,
              number: await nextNumber(tx, "orderSeq"),
              type: "dine_in",
              source: "qr",
              tableId: table.id,
              activeTableId: table.id,
              customerName: body.name || null,
              customerPhone: body.phone || null,
              createdByName: guest.name,
              ...orderRulesFrom(settings),
              ...defaultCharges("dine_in", settings),
              items: { create: lines.map((l) => ({ ...l, restaurantId: settings.restaurantId })) },
            },
          });
          return { order: await saveTotals(tx, await loadOrder(created.id, tx)), lines };
        });
        await logActivity(guest, "Guest ordered from QR", `Order #${result.order.number} at ${table.name}: ${itemSummary(result.lines)}`);
        return NextResponse.json({ ok: true, orderNumber: result.order.number, items: result.lines.map((l) => ({ name: l.name, variant: l.variant, quantity: l.quantity })) });
      } catch (error) {
        if (isUniqueViolation(error, "activeTableId")) fail("The staff just opened this table. Please try again.", 409);
        throw error;
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
