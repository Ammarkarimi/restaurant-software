import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/phone";
import { banquetEventSchema } from "@/lib/banquet";
import { assertBanquetAccess, eventData, findClashes, loadEvent, saveEventTotal, serializeEvent } from "@/lib/banquet-server";
import { formatDate } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

/** One booking with its totals, payments and any clash with another booking of the hall. */
export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const event = await loadEvent((await params).id);
    return NextResponse.json({ event: serializeEvent(event), clashes: await findClashes(event) });
  });
}

/** Saves the booking form. An invoiced (completed) function can no longer change, only take payments. */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const { id } = await params;
    const current = await loadEvent(id);
    if (current.status === "completed") fail("This function is invoiced. Its details can't be changed any more.");
    if (current.status === "cancelled") fail("This booking is cancelled. Open it again as an enquiry to change it.");
    const body = banquetEventSchema.parse(await request.json());
    if (!normalizePhone(body.customerPhone)) fail("Enter a valid phone number");
    if (current.status === "confirmed" && (await findClashes({ id, ...body })).length) fail("The hall is already booked at that time. Choose another hall or time.");
    const data = await eventData(body);
    const event = await prisma.$transaction(async (tx) => {
      await tx.banquetEvent.update({ where: { id }, data });
      return saveEventTotal(tx, id);
    });
    const changed = [current.date !== event.date && `date ${formatDate(event.date)}`, current.guests !== event.guests && `${event.guests} guests`, current.total !== event.total && `total ₹${event.total}`].filter(Boolean);
    await logActivity(user, "Edited banquet booking", `#${event.number} ${event.customerName}${changed.length ? `: ${changed.join(", ")}` : ""}`);
    return NextResponse.json({ event: serializeEvent(event), clashes: await findClashes(event) });
  });
}
