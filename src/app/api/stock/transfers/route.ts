import { NextRequest, NextResponse } from "next/server";
import { prisma, rawPrisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { outletsFor } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { nextNumber } from "@/lib/orders";
import { linesTotal } from "@/lib/purchases";
import { addStockEntry, round3 } from "@/lib/stock";
import { destinations, transferSchema } from "@/lib/transfers";

/** Transfers this outlet sent, those on their way to it, and the outlets it can send to. */
export async function GET() {
  return withAdmin(async (user) => {
    const [sent, incoming, outlets] = await Promise.all([
      prisma.stockTransfer.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      // Sent by another outlet: they belong to the sender, so they are read across outlets here,
      // only those addressed to this one.
      rawPrisma.stockTransfer.findMany({ where: { toRestaurantId: user.restaurantId }, orderBy: { createdAt: "desc" }, take: 100 }),
      outletsFor(user.id),
    ]);
    return NextResponse.json({ sent, incoming, outlets: destinations(outlets, user.restaurantId) });
  });
}

/** Sends stock to another outlet: it leaves this outlet's stock now. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = transferSchema.parse(await request.json());
    const to = destinations(await outletsFor(user.id), user.restaurantId).find((o) => o.id === body.toRestaurantId);
    if (!to) fail("You can only send stock to your own outlets.", 403);
    const settings = await getSettings();
    const items = await prisma.stockItem.findMany({ where: { id: { in: body.lines.map((l) => l.stockItemId) } } });
    const lines = body.lines.map((l) => {
      const item = items.find((i) => i.id === l.stockItemId);
      if (!item) fail("A stock item on this transfer was not found");
      if (round3(l.quantity) > round3(item.quantity)) fail(`Only ${round3(item.quantity)} ${item.unit} of ${item.name} is in stock.`);
      return { stockItemId: item.id, name: item.name, unit: item.unit, quantity: round3(l.quantity), rate: item.costPerUnit };
    });
    if (new Set(lines.map((l) => l.stockItemId)).size !== lines.length) fail("Each item can be on the transfer only once");
    const date = todayKey(settings.timezone);
    const transfer = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, "transferSeq");
      for (const l of lines) {
        await addStockEntry(tx, { stockItemId: l.stockItemId, type: "transfer_out", quantity: -l.quantity, date, createdByName: user.name, note: `Transfer #${number} to ${to.name}` });
      }
      return tx.stockTransfer.create({
        data: { restaurantId: settings.restaurantId, number, fromName: settings.restaurantName, toRestaurantId: to.id, toName: to.name, lines: JSON.stringify(lines), total: linesTotal(lines), notes: body.notes || null, sentOn: date, sentByName: user.name },
      });
    });
    await logActivity(user, "Sent stock", `Transfer #${transfer.number} to ${to.name}: ${lines.map((l) => `${l.name} ${l.quantity} ${l.unit}`).join(", ")}`);
    return NextResponse.json({ transfer }, { status: 201 });
  });
}
