import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertEditable, isUniqueViolation, loadOrder, saveTotals, serializeOrder, totalsOf } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { normalizePhone } from "@/lib/customers";
import { ORDER_SOURCES, formatCurrency, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    return NextResponse.json({ order: serializeOrder(await loadOrder(id)) });
  });
}

const schema = z
  .object({
    customerName: z.string().trim().max(100).nullable(),
    customerPhone: z.string().trim().max(20).nullable(),
    customerAddress: z.string().trim().max(300).nullable(),
    guests: z.coerce.number().int().min(0).max(500),
    notes: z.string().trim().max(500).nullable(),
    discountType: z.enum(["percent", "amount"]),
    discountValue: z.coerce.number().min(0).max(10_000_000),
    discountReason: z.string().trim().max(200).nullable(),
    pointsRedeemed: z.coerce.number().int("Use whole points").min(0).max(10_000_000),
    packingCharge: z.coerce.number().min(0).max(1_000_000),
    deliveryCharge: z.coerce.number().min(0).max(1_000_000),
    source: z.enum(ORDER_SOURCES),
    sourceRef: z.string().trim().max(40).nullable(),
    // Move a dine-in order to another table (or turn it into takeaway with null).
    tableId: z.string().nullable(),
  })
  .partial();

/** Customer details, discount, packing / delivery charges, or moving the order to another table. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const order = await loadOrder(id);
    assertEditable(order);
    if (body.discountType === "percent" && (body.discountValue ?? 0) > 100) fail("A discount cannot be more than 100%");

    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    if (body.pointsRedeemed) {
      const settings = await getSettings();
      if (!settings.loyaltyEnabled) fail("Loyalty points are switched off in Settings");
      const phone = normalizePhone(body.customerPhone !== undefined ? body.customerPhone : order.customerPhone);
      const customer = phone ? await prisma.customer.findFirst({ where: { phone } }) : null;
      if (!customer) fail("Add the customer's phone number first. Points belong to a customer.");
      if (customer.points < body.pointsRedeemed) fail(`This customer has only ${customer.points} points`);
      if (customer.points < settings.loyaltyMinRedeem) fail(`Points can be used once the customer has ${settings.loyaltyMinRedeem} points`);
      const t = totalsOf(order);
      const room = t.itemsTotal - (t.discount - t.pointsDiscount);
      if (body.pointsRedeemed > room) fail(`At most ${Math.floor(room)} points can be used on this bill`);
    }
    let move: { from: string; to: string } | null = null;
    let tableData = {};
    if (body.tableId !== undefined && body.tableId !== order.tableId) {
      if (!body.tableId) fail("Choose the table to move this order to");
      const table = await prisma.diningTable.findFirst({ where: { id: body.tableId, active: true } });
      if (!table) fail("This table was not found");
      // Seating a takeaway order at a table: no packing or delivery any more.
      tableData = { type: "dine_in", tableId: table.id, activeTableId: table.id, ...(order.type !== "dine_in" && { packingCharge: 0, deliveryCharge: 0 }) };
      move = { from: order.table?.name ?? order.type, to: table.name };
    }

    const discountChanged =
      (body.discountValue !== undefined && body.discountValue !== order.discountValue) ||
      (body.discountType !== undefined && body.discountType !== order.discountType);
    const pointsChanged = body.pointsRedeemed !== undefined && body.pointsRedeemed !== order.pointsRedeemed;
    const chargesChanged =
      (body.packingCharge !== undefined && body.packingCharge !== order.packingCharge) ||
      (body.deliveryCharge !== undefined && body.deliveryCharge !== order.deliveryCharge);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            customerName: text(body.customerName),
            customerPhone: text(body.customerPhone),
            customerAddress: text(body.customerAddress),
            notes: text(body.notes),
            discountReason: text(body.discountReason),
            ...(body.guests !== undefined && { guests: body.guests }),
            ...(body.discountType && { discountType: body.discountType }),
            ...(body.discountValue !== undefined && { discountValue: body.discountValue }),
            ...(body.pointsRedeemed !== undefined && { pointsRedeemed: body.pointsRedeemed }),
            ...(body.packingCharge !== undefined && { packingCharge: body.packingCharge }),
            ...(body.deliveryCharge !== undefined && { deliveryCharge: body.deliveryCharge }),
            ...(body.source && { source: body.source }),
            sourceRef: text(body.sourceRef),
            ...tableData,
            // A changed bill must be printed again.
            ...((discountChanged || chargesChanged || pointsChanged) && order.status === "billed" && { status: "open" }),
          },
        });
        return saveTotals(tx, await loadOrder(id, tx));
      });
      if (move) await logActivity(user, "Moved order", `#${order.number} from ${move.from} to ${move.to}`);
      if (discountChanged) {
        const d = updated.discountValue > 0 ? (updated.discountType === "percent" ? `${updated.discountValue}%` : formatCurrency(updated.discountValue)) : "removed";
        await logActivity(user, "Changed discount", `Order #${order.number}: ${d}${updated.discountReason ? ` (${updated.discountReason})` : ""}`);
      }
      if (chargesChanged) {
        const what = [
          updated.packingCharge > 0 && `packing ${formatCurrency(updated.packingCharge)}`,
          updated.deliveryCharge > 0 && `delivery ${formatCurrency(updated.deliveryCharge)}`,
        ].filter(Boolean);
        await logActivity(user, "Changed charges", `Order #${order.number}: ${what.join(", ") || "removed"}`);
      }
      if (pointsChanged) await logActivity(user, "Loyalty points used", `Order #${order.number}: ${updated.pointsRedeemed} points${updated.customerName ? ` for ${updated.customerName}` : ""}`);
      if (body.source && body.source !== order.source) await logActivity(user, "Changed order source", `Order #${order.number}: ${label(body.source)}`);
      return NextResponse.json({ order: serializeOrder(updated) });
    } catch (error) {
      if (isUniqueViolation(error, "activeTableId")) fail("That table already has a running order. Choose a free table.", 409);
      throw error;
    }
  });
}
