import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";

/**
 * Staff shifts. Everyone sees whether their own shift is running; the owner / manager also gets
 * a month (?month=YYYY-MM) with each person's days and hours.
 */
export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const open = await prisma.attendance.findFirst({ where: { staffId: user.id, outAt: null }, orderBy: { inAt: "desc" } });
    const month = new URL(request.url).searchParams.get("month");
    if (!month || !isAdmin(user)) return NextResponse.json({ open });
    if (!/^\d{4}-\d{2}$/.test(month)) fail("Choose a month");
    const rows = await prisma.attendance.findMany({ where: { date: { gte: `${month}-01`, lte: `${month}-31` } }, orderBy: [{ date: "asc" }, { inAt: "asc" }] });
    const now = Date.now();
    const people = new Map<string, { staffId: string; name: string; days: Set<string>; minutes: number; open: boolean }>();
    for (const r of rows) {
      const p = people.get(r.staffId) ?? { staffId: r.staffId, name: r.staffName, days: new Set<string>(), minutes: 0, open: false };
      p.days.add(r.date);
      // A shift still running counts up to now (at most 16 hours, in case someone forgot to end it).
      const end = r.outAt?.getTime() ?? Math.min(now, r.inAt.getTime() + 16 * 3600_000);
      p.minutes += Math.max(0, (end - r.inAt.getTime()) / 60_000);
      if (!r.outAt && r.date === todayKey(settings.timezone)) p.open = true;
      people.set(r.staffId, p);
    }
    return NextResponse.json({
      open,
      month,
      people: [...people.values()].map((p) => ({ staffId: p.staffId, name: p.name, days: p.days.size, hours: Math.round((p.minutes / 60) * 10) / 10, onShift: p.open })).sort((a, b) => a.name.localeCompare(b.name)),
      rows: rows.map((r) => ({ id: r.id, staffName: r.staffName, date: r.date, inAt: r.inAt, outAt: r.outAt })),
    });
  });
}

/** Start or end my shift. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const { action } = z.object({ action: z.enum(["in", "out"]) }).parse(await request.json());
    const settings = await getSettings();
    const open = await prisma.attendance.findFirst({ where: { staffId: user.id, outAt: null }, orderBy: { inAt: "desc" } });
    if (action === "in") {
      if (open) fail("Your shift has already started.");
      const row = await prisma.attendance.create({ data: { restaurantId: settings.restaurantId, staffId: user.id, staffName: user.name, date: todayKey(settings.timezone), inAt: new Date() } });
      await logActivity(user, "Started shift");
      return NextResponse.json({ open: row });
    }
    if (!open) fail("Your shift has not started.");
    await prisma.attendance.update({ where: { id: open.id }, data: { outAt: new Date() } });
    await logActivity(user, "Ended shift");
    return NextResponse.json({ open: null });
  });
}
