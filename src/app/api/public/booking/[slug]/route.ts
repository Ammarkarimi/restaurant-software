import { NextRequest, NextResponse } from "next/server";
import { prisma, runForRestaurant } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findRestaurantBySlug } from "@/lib/public-menu";
import { normalizePhone } from "@/lib/phone";
import { addDays, todayKey } from "@/lib/dates";
import { reservationSchema, timeLabel } from "@/lib/reservations";
import { formatDate } from "@/lib/utils";

/** A guest asks for a table from the restaurant's booking link. Staff confirm it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!rateLimit(`booking:${clientIp(request.headers)}`, 5, 60 * 60_000)) fail("Too many requests from this phone. Please call the restaurant.", 429);
    const found = await findRestaurantBySlug(slug);
    if (!found || !found.settings.onlineBookingEnabled) fail("Table booking is not available here", 404);
    const body = reservationSchema.omit({ tableId: true, source: true }).parse(await request.json());
    if (!normalizePhone(body.phone)) fail("Please enter a valid phone number");
    if (body.guests > 30) fail("For more than 30 guests, please call the restaurant.");
    const today = todayKey(found.settings.timezone);
    if (body.date < today || body.date > addDays(today, 60)) fail("Choose a date in the next 60 days");
    return await runForRestaurant(found.restaurant.id, async () => {
      const r = await prisma.reservation.create({
        data: { restaurantId: found.restaurant.id, ...body, occasion: body.occasion || null, notes: body.notes || null, source: "online", status: "requested", createdByName: "Booking link" },
      });
      await logActivity({ id: null, name: "Booking link" }, "Booking request", `${r.name} (${r.guests}) on ${formatDate(r.date)} at ${timeLabel(r.time)}`);
      return NextResponse.json({ ok: true }, { status: 201 });
    });
  } catch (error) {
    return handleError(error);
  }
}
