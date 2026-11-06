// Server helpers for banquet bookings: loading, totals and the hall double-booking check.
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "./db";
import { fail } from "./api";
import { can } from "./permissions";
import { banquetTotals, clashes, parseExtras, parseMenu, type BanquetEventInput } from "./banquet";
import type { SessionUser } from "./session";



export const eventInclude = {
  hall: { select: { id: true, name: true, capacity: true } },
  payments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.BanquetEventInclude;

export type FullEvent = Prisma.BanquetEventGetPayload<{ include: typeof eventInclude }>;

export function assertBanquetAccess(user: SessionUser) {
  if (!can(user, "banquets")) fail("You are not allowed to handle banquet bookings. Ask the owner / manager.", 403);
}

export async function loadEvent(id: string, db: Db = prisma): Promise<FullEvent> {
  const event = await db.banquetEvent.findFirst({ where: { id }, include: eventInclude });
  if (!event) fail("Booking not found", 404);
  return event;
}

export function totalsOfEvent(e: Pick<FullEvent, "guests" | "guaranteedGuests" | "finalGuests" | "pricePerPlate" | "hallRent" | "extras" | "discount" | "foodTaxRate" | "otherTaxRate" | "taxMode">) {
  return banquetTotals({ ...e, extras: parseExtras(e.extras) });
}

export function serializeEvent(e: FullEvent) {
  const totals = totalsOfEvent(e);
  const paid = Math.round(e.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  return { ...e, menu: parseMenu(e.menu), extras: parseExtras(e.extras), totals, paid, balance: Math.round((totals.total - paid) * 100) / 100 };
}

export type EventView = ReturnType<typeof serializeEvent>;

/** Other bookings holding the same hall at an overlapping time. */
export async function findClashes(e: { id?: string; hallId?: string | null; date: string; startTime: string; endTime: string }) {
  if (!e.hallId) return [];
  const sameDay = await prisma.banquetEvent.findMany({
    where: { hallId: e.hallId, date: e.date, status: { in: ["tentative", "confirmed"] } },
    select: { id: true, number: true, hallId: true, date: true, startTime: true, endTime: true, status: true, customerName: true },
  });
  return clashes({ id: e.id ?? "", hallId: e.hallId, date: e.date, startTime: e.startTime, endTime: e.endTime }, sameDay);
}

/** Fields saved from the booking form (package name copied, lists stored as JSON). */
export async function eventData(body: BanquetEventInput) {
  const pkg = body.packageId ? await prisma.banquetPackage.findFirst({ where: { id: body.packageId } }) : null;
  if (body.packageId && !pkg) fail("This package was not found");
  if (body.hallId && !(await prisma.banquetHall.findFirst({ where: { id: body.hallId } }))) fail("This hall was not found");
  return {
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    customerEmail: body.customerEmail || null,
    customerGstin: body.customerGstin || null,
    company: body.company || null,
    eventType: body.eventType,
    title: body.title || null,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    hallId: body.hallId || null,
    guests: body.guests,
    guaranteedGuests: body.guaranteedGuests,
    finalGuests: body.finalGuests ?? null,
    packageId: pkg?.id ?? null,
    packageName: pkg?.name ?? null,
    pricePerPlate: body.pricePerPlate,
    menu: JSON.stringify(body.menu),
    extras: JSON.stringify(body.extras),
    hallRent: body.hallRent,
    discount: body.discount,
    foodTaxRate: body.foodTaxRate,
    otherTaxRate: body.otherTaxRate,
    notes: body.notes || null,
  };
}

/** Saves the total on the row, so lists and reports need no maths. */
export async function saveEventTotal(db: Db, id: string) {
  const e = await loadEvent(id, db);
  const total = totalsOfEvent(e).total;
  if (total !== e.total) await db.banquetEvent.update({ where: { id }, data: { total } });
  return loadEvent(id, db);
}
