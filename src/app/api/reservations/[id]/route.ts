import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { isUniqueViolation, nextNumber, orderRulesFrom, defaultCharges } from "@/lib/orders";
import { RESERVATION_STATUSES, reservationSchema, timeLabel } from "@/lib/reservations";
import { formatDate, label } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const schema = reservationSchema
  .partial()
  .extend({
    status: z.enum(RESERVATION_STATUSES).optional(),
    // Seat the guests now: opens an order on the booked (or chosen) table with their name and phone.
    seat: z.boolean().optional(),
  });

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const existing = await prisma.reservation.findFirst({ where: { id } });
    if (!existing) fail("Booking not found", 404);
    if (body.tableId && !(await prisma.diningTable.findFirst({ where: { id: body.tableId, active: true } }))) fail("This table was not found");
    const { seat, ...fields } = body;

    if (seat) {
      const tableId = fields.tableId ?? existing.tableId;
      if (!tableId) fail("Choose a table to seat them at");
      const settings = await getSettings();
      try {
        const order = await prisma.$transaction(async (tx) => {
          const running = await tx.order.findFirst({ where: { activeTableId: tableId, status: { in: ["open", "billed"] } } });
          if (running) fail("That table has a running order. Choose a free table.");
          const created = await tx.order.create({
            data: {
              restaurantId: settings.restaurantId,
              number: await nextNumber(tx, "orderSeq"),
              type: "dine_in",
              source: "counter",
              tableId,
              activeTableId: tableId,
              customerName: existing.name,
              customerPhone: existing.phone,
              guests: fields.guests ?? existing.guests,
              notes: [existing.occasion, existing.notes].filter(Boolean).join(" · ") || null,
              createdById: user.id,
              createdByName: user.name,
              ...orderRulesFrom(settings),
              ...defaultCharges("dine_in", settings),
            },
          });
          await tx.reservation.update({ where: { id }, data: { ...fields, tableId, status: "seated", orderId: created.id } });
          return created;
        });
        await logActivity(user, "Seated a booking", `${existing.name} (${existing.guests}) — order #${order.number}`);
        return NextResponse.json({ orderId: order.id });
      } catch (error) {
        if (isUniqueViolation(error, "activeTableId")) fail("That table just got an order. Choose another table.", 409);
        throw error;
      }
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { ...fields, ...(fields.tableId === null && { tableId: null }) },
      include: { table: { select: { id: true, name: true, area: true } } },
    });
    if (body.status && body.status !== existing.status) {
      await logActivity(user, "Booking " + label(body.status).toLowerCase(), `${reservation.name} on ${formatDate(reservation.date)} at ${timeLabel(reservation.time)}`);
    } else {
      await logActivity(user, "Changed a booking", `${reservation.name} on ${formatDate(reservation.date)} at ${timeLabel(reservation.time)}`);
    }
    return NextResponse.json({ reservation });
  });
}
