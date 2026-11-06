import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { addDays, todayKey } from "@/lib/dates";
import { nextNumber } from "@/lib/orders";
import { normalizePhone } from "@/lib/phone";
import { banquetEventSchema, BANQUET_STATUSES } from "@/lib/banquet";
import { assertBanquetAccess, eventData, findClashes, saveEventTotal, serializeEvent } from "@/lib/banquet-server";
import { formatDate } from "@/lib/utils";

/**
 * Bookings list. view = upcoming (default: today onwards, not cancelled), enquiries, past, cancelled, all;
 * or month = "YYYY-MM" for the calendar. Also halls, packages and this month's numbers.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const sp = new URL(request.url).searchParams;
    const view = sp.get("view") ?? "upcoming";
    const month = sp.get("month");
    const q = sp.get("q")?.trim();

    const where: Prisma.BanquetEventWhereInput = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) where.date = { gte: `${month}-01`, lte: `${month}-31` };
    else if (view === "upcoming") Object.assign(where, { date: { gte: today }, status: { in: ["enquiry", "tentative", "confirmed"] } });
    else if (view === "enquiries") Object.assign(where, { status: { in: ["enquiry", "tentative"] } });
    else if (view === "past") Object.assign(where, { OR: [{ date: { lt: today }, status: { not: "cancelled" } }, { status: "completed" }] });
    else if (view === "cancelled") where.status = "cancelled";
    if (q) {
      const n = Number(q.replace(/^#/, ""));
      where.AND = [{ OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }, { title: { contains: q, mode: "insensitive" } }, { invoiceNumber: { contains: q, mode: "insensitive" } }, ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : [])] }];
    }
    const monthStart = `${today.slice(0, 7)}-01`;
    const [events, halls, packages, monthEvents, due] = await Promise.all([
      prisma.banquetEvent.findMany({
        where,
        include: { hall: { select: { id: true, name: true } }, payments: { select: { amount: true } } },
        orderBy: view === "past" || view === "cancelled" ? [{ date: "desc" }] : [{ date: "asc" }, { startTime: "asc" }],
        take: 300,
      }),
      prisma.banquetHall.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.banquetPackage.findMany({ orderBy: [{ sortOrder: "asc" }, { pricePerPlate: "asc" }] }),
      prisma.banquetEvent.findMany({ where: { date: { gte: monthStart, lte: `${today.slice(0, 7)}-31` }, status: { in: ["confirmed", "completed"] } }, select: { total: true, guests: true } }),
      prisma.banquetEvent.findMany({ where: { status: { in: ["confirmed", "completed"] } }, select: { total: true, payments: { select: { amount: true } } } }),
    ]);
    const paidOf = (p: Array<{ amount: number }>) => p.reduce((s, x) => s + x.amount, 0);
    return NextResponse.json({
      today,
      events: events.map(({ payments, ...e }) => ({ ...e, paid: Math.round(paidOf(payments) * 100) / 100 })),
      halls,
      packages,
      stats: {
        monthEvents: monthEvents.length,
        monthGuests: monthEvents.reduce((s, e) => s + e.guests, 0),
        monthValue: Math.round(monthEvents.reduce((s, e) => s + e.total, 0)),
        balanceDue: Math.round(due.reduce((s, e) => s + Math.max(0, e.total - paidOf(e.payments)), 0)),
        nextWeek: await prisma.banquetEvent.count({ where: { date: { gte: today, lte: addDays(today, 6) }, status: "confirmed" } }),
        openEnquiries: await prisma.banquetEvent.count({ where: { status: { in: ["enquiry", "tentative"] }, date: { gte: today } } }),
      },
    });
  });
}

const createSchema = banquetEventSchema.extend({ status: z.enum(BANQUET_STATUSES).default("enquiry") });

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const body = createSchema.parse(await request.json());
    const settings = await getSettings();
    if (!normalizePhone(body.customerPhone)) fail("Enter a valid phone number");
    if (!["enquiry", "tentative", "confirmed"].includes(body.status)) fail("A new booking starts as an enquiry, tentative or confirmed");
    if (body.status === "confirmed" && (await findClashes(body)).length) fail("The hall is already booked at that time. Choose another hall or time, or save it as an enquiry.");
    const data = await eventData(body);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.banquetEvent.create({
        data: { restaurantId: settings.restaurantId, number: await nextNumber(tx, "banquetSeq"), status: body.status, taxMode: settings.taxMode === "none" ? "none" : "gst", createdByName: user.name, ...data },
      });
      return saveEventTotal(tx, created.id);
    });
    await logActivity(user, "Banquet booking", `#${event.number} ${event.customerName}: ${event.eventType} on ${formatDate(event.date)}, ${event.guests} guests (${event.status})`);
    return NextResponse.json({ event: serializeEvent(event) }, { status: 201 });
  });
}
