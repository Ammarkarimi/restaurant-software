import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { defaultCharges, isUniqueViolation, nextNumber, orderRulesFrom } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["notified", "seat", "left", "back"]),
  tableId: z.string().max(40).optional(),
});

/**
 * notified = told the table is ready (the WhatsApp message is sent from the counter's phone);
 * seat = opens an order on a free table with their name and phone; left = they went away;
 * back = undo "left".
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const entry = await prisma.waitlistEntry.findFirst({ where: { id } });
    if (!entry) fail("Not on the waitlist", 404);
    if (body.action === "notified") {
      await prisma.waitlistEntry.update({ where: { id }, data: { notifiedAt: new Date() } });
      return NextResponse.json({ success: true });
    }
    if (body.action === "left" || body.action === "back") {
      if (entry.status === "seated") fail("They are already seated.");
      await prisma.waitlistEntry.update({ where: { id }, data: { status: body.action === "left" ? "left" : "waiting" } });
      await logActivity(user, body.action === "left" ? "Left the waitlist" : "Back on the waitlist", `${entry.name} (${entry.guests})`);
      return NextResponse.json({ success: true });
    }
    if (entry.status !== "waiting") fail("They are not waiting any more.");
    if (!body.tableId) fail("Choose a table");
    const table = await prisma.diningTable.findFirst({ where: { id: body.tableId, active: true } });
    if (!table) fail("This table was not found");
    const settings = await getSettings();
    try {
      const order = await prisma.$transaction(async (tx) => {
        const running = await tx.order.findFirst({ where: { activeTableId: table.id, status: { in: ["open", "billed"] } } });
        if (running) fail("That table has a running order. Choose a free table.");
        const created = await tx.order.create({
          data: {
            restaurantId: settings.restaurantId,
            number: await nextNumber(tx, "orderSeq"),
            type: "dine_in",
            source: "counter",
            tableId: table.id,
            activeTableId: table.id,
            customerName: entry.name,
            customerPhone: entry.phone,
            guests: entry.guests,
            notes: entry.notes,
            createdById: user.id,
            createdByName: user.name,
            ...orderRulesFrom(settings),
            ...defaultCharges("dine_in", settings),
          },
        });
        await tx.waitlistEntry.update({ where: { id }, data: { status: "seated", seatedAt: new Date(), tableId: table.id, orderId: created.id } });
        return created;
      });
      await logActivity(user, "Seated from waitlist", `${entry.name} (${entry.guests}) at ${table.name} — order #${order.number}`);
      return NextResponse.json({ orderId: order.id });
    } catch (error) {
      if (isUniqueViolation(error, "activeTableId")) fail("That table just got an order. Choose another table.", 409);
      throw error;
    }
  });
}
