import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { addDays, isDateKey, todayKey } from "@/lib/dates";
import { normalizePhone } from "@/lib/phone";
import { reservationSchema, timeLabel } from "@/lib/reservations";
import { formatDate } from "@/lib/utils";

/** Bookings for a day (default today), plus how many are booked on each of the next 7 days. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const asked = new URL(request.url).searchParams.get("date");
    const date = isDateKey(asked) ? asked : today;
    const week = addDays(today, 6);
    const [reservations, upcoming, requested] = await Promise.all([
      prisma.reservation.findMany({ where: { date }, include: { table: { select: { id: true, name: true, area: true } } }, orderBy: [{ time: "asc" }, { createdAt: "asc" }] }),
      prisma.reservation.groupBy({ by: ["date"], where: { date: { gte: today, lte: week }, status: { in: ["booked", "requested"] } }, _count: true, _sum: { guests: true } }),
      prisma.reservation.count({ where: { status: "requested", date: { gte: today } } }),
    ]);
    return NextResponse.json({
      date,
      today,
      reservations,
      requested,
      days: Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i);
        const row = upcoming.find((u) => u.date === d);
        return { date: d, bookings: row?._count ?? 0, guests: row?._sum.guests ?? 0 };
      }),
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = reservationSchema.parse(await request.json());
    const settings = await getSettings();
    if (body.date < todayKey(settings.timezone)) fail("Choose today or a later date");
    if (!normalizePhone(body.phone)) fail("Enter a valid phone number");
    if (body.tableId && !(await prisma.diningTable.findFirst({ where: { id: body.tableId, active: true } }))) fail("This table was not found");
    const reservation = await prisma.reservation.create({
      data: { restaurantId: settings.restaurantId, ...body, tableId: body.tableId || null, occasion: body.occasion || null, notes: body.notes || null, status: "booked", createdByName: user.name },
      include: { table: { select: { id: true, name: true, area: true } } },
    });
    await logActivity(user, "Booked a table", `${reservation.name} (${reservation.guests}) on ${formatDate(reservation.date)} at ${timeLabel(reservation.time)}${reservation.table ? `, table ${reservation.table.name}` : ""}`);
    return NextResponse.json({ reservation }, { status: 201 });
  });
}
