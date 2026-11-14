import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, rawPrisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { convertQuantity } from "@/lib/purchases";
import { addStockEntry } from "@/lib/stock";
import { parseTransferLines } from "@/lib/transfers";

const schema = z.object({ action: z.enum(["receive", "cancel"]) });

/**
 * receive: the outlet it was sent to adds it to their stock (matching items by name, adding any
 * they don't have yet). cancel: the sender takes back a transfer that has not been received.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const { action } = schema.parse(await request.json());
    const settings = await getSettings();
    const date = todayKey(settings.timezone);
    const transfer = await rawPrisma.stockTransfer.findUnique({ where: { id } });
    if (!transfer) fail("Transfer not found", 404);
    const lines = parseTransferLines(transfer.lines);

    if (action === "cancel") {
      if (transfer.restaurantId !== user.restaurantId) fail("Only the outlet that sent it can cancel a transfer.", 403);
      const claimed = await rawPrisma.stockTransfer.updateMany({ where: { id, status: "sent" }, data: { status: "cancelled" } });
      if (claimed.count !== 1) fail("This transfer was already received or cancelled.");
      await prisma.$transaction(async (tx) => {
        for (const l of lines) {
          if (await tx.stockItem.findFirst({ where: { id: l.stockItemId } })) {
            await addStockEntry(tx, { stockItemId: l.stockItemId, type: "transfer_in", quantity: l.quantity, date, createdByName: user.name, note: `Transfer #${transfer.number} cancelled` });
          }
        }
      });
      await logActivity(user, "Cancelled stock transfer", `#${transfer.number} to ${transfer.toName}`);
      return NextResponse.json({ success: true });
    }

    if (transfer.toRestaurantId !== user.restaurantId) fail("This transfer was sent to another outlet.", 403);
    const mine = await prisma.stockItem.findMany();
    // Work out every line before anything changes, so a unit that doesn't fit stops the whole receipt.
    const plan = lines.map((l) => {
      const item = mine.find((i) => i.name.trim().toLowerCase() === l.name.trim().toLowerCase());
      if (!item) return { line: l, item: null, quantity: l.quantity };
      const conv = convertQuantity(l.quantity, l.unit, item.unit);
      if (!conv.converted && item.unit !== l.unit) fail(`${l.name} was sent in ${l.unit} but your stock counts it in ${item.unit}. Change the unit of one of them first.`);
      return { line: l, item, quantity: conv.quantity };
    });
    const claimed = await rawPrisma.stockTransfer.updateMany({ where: { id, status: "sent" }, data: { status: "received", receivedOn: date, receivedByName: user.name } });
    if (claimed.count !== 1) fail("This transfer was already received or cancelled.");
    try {
      await prisma.$transaction(async (tx) => {
        for (const p of plan) {
          const item = p.item ?? (await tx.stockItem.create({ data: { restaurantId: settings.restaurantId, name: p.line.name, unit: p.line.unit, costPerUnit: p.line.rate } }));
          await addStockEntry(tx, { stockItemId: item.id, type: "transfer_in", quantity: p.quantity, date, createdByName: user.name, supplier: transfer.fromName, note: `Transfer #${transfer.number} from ${transfer.fromName}` });
          if (!item.costPerUnit && p.line.rate) await tx.stockItem.update({ where: { id: item.id }, data: { costPerUnit: p.line.rate } });
        }
      });
    } catch (error) {
      await rawPrisma.stockTransfer.update({ where: { id }, data: { status: "sent", receivedOn: null, receivedByName: null } });
      throw error;
    }
    await logActivity(user, "Received stock", `Transfer #${transfer.number} from ${transfer.fromName}`);
    return NextResponse.json({ success: true });
  });
}
