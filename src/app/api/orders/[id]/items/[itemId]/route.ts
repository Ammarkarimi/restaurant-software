import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertEditable, loadOrder, saveTotals, serializeOrder, type FullOrder } from "@/lib/orders";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; itemId: string }> };

const schema = z.object({
  quantity: z.coerce.number().int().min(0).max(999).optional(),
  note: z.string().trim().max(200).nullable().optional(),
  reason: z.string().trim().max(200).optional(),
});

function itemName(i: { name: string; variant: string | null }) {
  return i.variant ? `${i.name} (${i.variant})` : i.name;
}

async function findItem(orderId: string, itemId: string) {
  const order = await loadOrder(orderId);
  assertEditable(order);
  const item = order.items.find((i) => i.id === itemId && i.status === "active");
  if (!item) fail("This item is no longer on the order", 404);
  return { order, item };
}

function reopenIfBilled(order: FullOrder) {
  return order.status === "billed" ? { status: "open" } : {};
}

/**
 * Changes quantity or note. Items not yet sent to the kitchen change freely.
 * Items the kitchen already has can only be reduced, with a reason, and the
 * removed quantity is kept as a cancelled line for the owner to see.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id, itemId } = await params;
    const body = schema.parse(await request.json());
    const { order, item } = await findItem(id, itemId);
    const quantity = body.quantity ?? item.quantity;

    const updated = await prisma.$transaction(async (tx) => {
      if (item.kotNumber === null) {
        if (quantity === 0) await tx.orderItem.delete({ where: { id: item.id } });
        else await tx.orderItem.update({ where: { id: item.id }, data: { quantity, ...(body.note !== undefined && { note: body.note || null }) } });
      } else {
        if (body.note !== undefined && (body.note || null) !== item.note) fail("The kitchen already has this item. Add a new item with the note instead.");
        if (quantity > item.quantity) fail("The kitchen already has this item. Add the extra quantity as a new item so the kitchen gets a ticket.");
        if (quantity < item.quantity) {
          if (!can(user, "cancelItems")) fail("You are not allowed to remove dishes the kitchen already has. Ask the owner / manager.", 403);
          if (!body.reason) fail("Please give a reason for removing an item the kitchen already has");
          const removed = item.quantity - quantity;
          if (quantity === 0) {
            await tx.orderItem.update({ where: { id: item.id }, data: { status: "cancelled", cancelReason: body.reason } });
          } else {
            await tx.orderItem.update({ where: { id: item.id }, data: { quantity } });
            const { id: _skip, createdAt: _c, ...copy } = item;
            void _skip;
            void _c;
            await tx.orderItem.create({ data: { ...copy, quantity: removed, status: "cancelled", cancelReason: body.reason } });
          }
        }
      }
      await tx.order.update({ where: { id }, data: reopenIfBilled(order) });
      return saveTotals(tx, await loadOrder(id, tx));
    });

    if (item.kotNumber !== null && quantity < item.quantity) {
      await logActivity(user, "Removed item after KOT", `Order #${order.number}: ${item.quantity - quantity} × ${itemName(item)} (${body.reason})`);
    }
    return NextResponse.json({ order: serializeOrder(updated) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id, itemId } = await params;
    const { reason } = z.object({ reason: z.string().trim().max(200).optional() }).parse(await request.json().catch(() => ({})));
    const { order, item } = await findItem(id, itemId);
    if (item.kotNumber !== null && !reason) fail("Please give a reason for removing an item the kitchen already has");

    const updated = await prisma.$transaction(async (tx) => {
      if (item.kotNumber === null) await tx.orderItem.delete({ where: { id: item.id } });
      else await tx.orderItem.update({ where: { id: item.id }, data: { status: "cancelled", cancelReason: reason } });
      await tx.order.update({ where: { id }, data: reopenIfBilled(order) });
      return saveTotals(tx, await loadOrder(id, tx));
    });
    if (item.kotNumber !== null) {
      await logActivity(user, "Removed item after KOT", `Order #${order.number}: ${item.quantity} × ${itemName(item)} (${reason})`);
    }
    return NextResponse.json({ order: serializeOrder(updated) });
  });
}
