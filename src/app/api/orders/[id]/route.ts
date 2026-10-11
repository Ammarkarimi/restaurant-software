import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertEditable, isUniqueViolation, loadOrder, saveTotals, serializeOrder } from "@/lib/orders";
import { formatCurrency } from "@/lib/utils";

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
    // Move a dine-in order to another table (or turn it into takeaway with null).
    tableId: z.string().nullable(),
  })
  .partial();

/** Customer details, discount, or moving the order to another table. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const order = await loadOrder(id);
    assertEditable(order);
    if (body.discountType === "percent" && (body.discountValue ?? 0) > 100) fail("A discount cannot be more than 100%");

    const text = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    let move: { from: string; to: string } | null = null;
    let tableData = {};
    if (body.tableId !== undefined && body.tableId !== order.tableId) {
      if (!body.tableId) fail("Choose the table to move this order to");
      const table = await prisma.diningTable.findFirst({ where: { id: body.tableId, active: true } });
      if (!table) fail("This table was not found");
      tableData = { type: "dine_in", tableId: table.id, activeTableId: table.id };
      move = { from: order.table?.name ?? order.type, to: table.name };
    }

    const discountChanged =
      (body.discountValue !== undefined && body.discountValue !== order.discountValue) ||
      (body.discountType !== undefined && body.discountType !== order.discountType);

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
            ...tableData,
            // A changed bill must be printed again.
            ...(discountChanged && order.status === "billed" && { status: "open" }),
          },
        });
        return saveTotals(tx, await loadOrder(id, tx));
      });
      if (move) await logActivity(user, "Moved order", `#${order.number} from ${move.from} to ${move.to}`);
      if (discountChanged) {
        const d = updated.discountValue > 0 ? (updated.discountType === "percent" ? `${updated.discountValue}%` : formatCurrency(updated.discountValue)) : "removed";
        await logActivity(user, "Changed discount", `Order #${order.number}: ${d}${updated.discountReason ? ` (${updated.discountReason})` : ""}`);
      }
      return NextResponse.json({ order: serializeOrder(updated) });
    } catch (error) {
      if (isUniqueViolation(error, "activeTableId")) fail("That table already has a running order. Choose a free table.", 409);
      throw error;
    }
  });
}
