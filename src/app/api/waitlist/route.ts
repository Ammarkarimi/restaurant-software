import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";

/** Today's waitlist: people still waiting first (oldest on top), then those seated or gone. */
export async function GET() {
  return withAuth(async () => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const [entries, tables, busy] = await Promise.all([
      prisma.waitlistEntry.findMany({ where: { OR: [{ date: today }, { status: "waiting" }] }, orderBy: { createdAt: "asc" } }),
      prisma.diningTable.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, area: true, seats: true } }),
      prisma.order.findMany({ where: { activeTableId: { not: null } }, select: { activeTableId: true } }),
    ]);
    const seated = entries.filter((e) => e.status === "seated" && e.seatedAt);
    // How long people actually waited today, to quote the next party.
    const avgWait = seated.length ? Math.round(seated.reduce((s, e) => s + (e.seatedAt!.getTime() - e.createdAt.getTime()) / 60_000, 0) / seated.length) : null;
    const busyIds = new Set(busy.map((o) => o.activeTableId));
    return NextResponse.json({ entries, avgWait, today, tables: tables.map((t) => ({ ...t, free: !busyIds.has(t.id) })) });
  });
}

const waitlistSchema = z.object({
  name: z.string().trim().min(1, "Enter the guest's name").max(80),
  phone: z.string().trim().max(20).nullable().optional(),
  guests: z.coerce.number().int().min(1).max(100),
  quotedMins: z.coerce.number().int().min(0).max(300).nullable().optional(),
  notes: z.string().trim().max(200).nullable().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = waitlistSchema.parse(await request.json());
    const settings = await getSettings();
    const entry = await prisma.waitlistEntry.create({
      data: { restaurantId: settings.restaurantId, ...body, phone: body.phone?.replace(/[^\d+]/g, "") || null, notes: body.notes || null, quotedMins: body.quotedMins ?? null, date: todayKey(settings.timezone), createdByName: user.name },
    });
    await logActivity(user, "Added to waitlist", `${entry.name} (${entry.guests})`);
    return NextResponse.json({ entry }, { status: 201 });
  });
}
