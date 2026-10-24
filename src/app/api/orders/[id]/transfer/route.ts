import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertEditable, isUniqueViolation, itemSummary, loadOrder, nextNumber, saveTotals, serializeOrder } from "@/lib/orders";

const schema = z.object({
  items: z
    .array(z.object({ itemId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999) }))
    .min(1, "Choose the items to move")
    .max(500),
  // Another table (its running order, or a new order if it is free), or a separate bill at the same table.
  to: z.union([z.object({ tableId: z.string().min(1) }), z.object({ newBill: z.literal(true) })]),
});

/**
 * Moves items from one order to another: split the bill (some guests pay separately),
 * merge two tables, or move a few dishes to the right table. Prices, kitchen tickets
 * and notes move with the items. An order left with nothing on it is closed.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const source = await loadOrder(id);
    assertEditable(source);

    const wanted = new Map<string, number>();
    for (const w of body.items) wanted.set(w.itemId, (wanted.get(w.itemId) ?? 0) + w.quantity);
    const moving = [...wanted.entries()].map(([itemId, quantity]) => {
      const item = source.items.find((i) => i.id === itemId && i.status === "active");
      if (!item) fail("An item on this order changed. Please try again.");
      if (quantity > item.quantity) fail(`There are only ${item.quantity} × ${item.name} on this order`);
      return { item, quantity };
    });
    const movesEverything = source.items.filter((i) => i.status === "active").every((i) => moving.some((m) => m.item.id === i.id && m.quantity === i.quantity));
    if (movesEverything && "newBill" in body.to) fail("To split the bill, leave at least one item on this order.");

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Find or open the order the items go to.
        let targetId: string;
        let targetLabel: string;
        if ("tableId" in body.to) {
          const table = await tx.diningTable.findFirst({ where: { id: body.to.tableId, active: true } });
          if (!table) fail("This table was not found");
          if (table.id === source.activeTableId) fail("The items are already on this table");
          const running = await tx.order.findFirst({ where: { activeTableId: table.id, status: { in: ["open", "billed"] } } });
          if (running) {
            targetId = running.id;
            targetLabel = `${table.name} (order #${running.number})`;
          } else if (movesEverything) {
            // Everything to a free table is simply moving the order there.
            const moved = await tx.order.update({
              where: { id: source.id },
              data: { type: "dine_in", tableId: table.id, activeTableId: table.id, ...(source.type !== "dine_in" && { packingCharge: 0, deliveryCharge: 0 }) },
            });
            return { source: null, target: await saveTotals(tx, await loadOrder(moved.id, tx)), targetLabel: table.name };
          } else {
            const created = await tx.order.create({
              data: {
                restaurantId: source.restaurantId,
                number: await nextNumber(tx, "orderSeq"),
                type: "dine_in",
                source: source.source === "qr" ? "qr" : "counter",
                tableId: table.id,
                activeTableId: table.id,
                guests: movesEverything ? source.guests : 0,
                customerName: movesEverything ? source.customerName : null,
                customerPhone: movesEverything ? source.customerPhone : null,
                createdById: user.id,
                createdByName: user.name,
                taxMode: source.taxMode,
                taxName: source.taxName,
                pricesIncludeTax: source.pricesIncludeTax,
                serviceChargePercent: source.serviceChargePercent,
                roundOff: source.roundOff,
                chargeTaxRate: source.chargeTaxRate,
              },
            });
            targetId = created.id;
            targetLabel = `${table.name} (new order #${created.number})`;
          }
        } else {
          const created = await tx.order.create({
            data: {
              restaurantId: source.restaurantId,
              number: await nextNumber(tx, "orderSeq"),
              type: source.type,
              source: source.source,
              sourceRef: source.sourceRef,
              // Same table, but the table's main order stays the running one.
              tableId: source.tableId,
              createdById: user.id,
              createdByName: user.name,
              taxMode: source.taxMode,
              taxName: source.taxName,
              pricesIncludeTax: source.pricesIncludeTax,
              serviceChargePercent: source.serviceChargePercent,
              roundOff: source.roundOff,
              chargeTaxRate: source.chargeTaxRate,
            },
          });
          targetId = created.id;
          targetLabel = `a separate bill (order #${created.number})`;
        }

        // 2. Move the items, splitting a line when only part of it moves.
        for (const { item, quantity } of moving) {
          if (quantity === item.quantity) {
            await tx.orderItem.update({ where: { id: item.id }, data: { orderId: targetId } });
          } else {
            await tx.orderItem.update({ where: { id: item.id }, data: { quantity: item.quantity - quantity } });
            const { id: _id, orderId: _o, ...copy } = item;
            void _id;
            void _o;
            await tx.orderItem.create({ data: { ...copy, orderId: targetId, quantity } });
          }
        }

        // 3. Both bills changed: they must be printed again.
        const target = await tx.order.findUniqueOrThrow({ where: { id: targetId } });
        if (target.status === "billed") await tx.order.update({ where: { id: targetId }, data: { status: "open" } });
        let closedSource = false;
        if (movesEverything) {
          // Keep removed-item history with the food, then close the empty order.
          await tx.orderItem.updateMany({ where: { orderId: source.id, status: "cancelled" }, data: { orderId: targetId } });
          if (source.billNumber) {
            await saveTotals(tx, await loadOrder(source.id, tx), {
              status: "cancelled",
              cancelReason: `Moved to ${targetLabel}`,
              cancelledAt: new Date(),
              activeTable: { disconnect: true },
            });
          } else {
            await tx.order.delete({ where: { id: source.id } });
          }
          closedSource = true;
        } else if (source.status === "billed") {
          await tx.order.update({ where: { id: source.id }, data: { status: "open" } });
        }

        const updatedTarget = await saveTotals(tx, await loadOrder(targetId, tx));
        const updatedSource = closedSource ? null : await saveTotals(tx, await loadOrder(source.id, tx));
        return { source: updatedSource, target: updatedTarget, targetLabel };
      });

      const from = source.table ? `${source.table.name} (order #${source.number})` : `order #${source.number}`;
      const what = itemSummary(moving.map((m) => ({ name: m.item.name, variant: m.item.variant, quantity: m.quantity })));
      await logActivity(user, "newBill" in body.to ? "Split bill" : "Moved items", `${what} from ${from} to ${result.targetLabel}`);
      return NextResponse.json({
        order: result.source ? serializeOrder(result.source) : null,
        target: serializeOrder(result.target),
      });
    } catch (error) {
      if (isUniqueViolation(error, "activeTableId")) fail("That table just got a new order. Please try again.", 409);
      throw error;
    }
  });
}
