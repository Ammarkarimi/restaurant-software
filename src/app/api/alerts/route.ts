import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";
import { ALERT_KINDS } from "@/lib/alert-rules";
import { emailReady, whatsappReady } from "@/lib/notify";

/** Recent owner alerts, newest first, with how many are unread. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const params = new URL(request.url).searchParams;
    // The sidebar only needs the number of unseen alerts.
    if (params.get("count")) return NextResponse.json({ unread: await prisma.alert.count({ where: { readAt: null } }) });
    const kind = params.get("kind");
    const where = kind && kind in ALERT_KINDS ? { kind } : {};
    const [alerts, unread, week] = await Promise.all([
      prisma.alert.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.alert.count({ where: { readAt: null } }),
      prisma.alert.groupBy({ by: ["kind"], where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, _count: true, _sum: { amount: true } }),
    ]);
    return NextResponse.json({
      alerts,
      unread,
      week: week.map((w) => ({ kind: w.kind, count: w._count, amount: Math.round((w._sum.amount ?? 0) * 100) / 100 })),
      channels: { whatsapp: whatsappReady(), email: emailReady() },
    });
  });
}

/** Marks alerts as seen: all of them, or the ones listed. */
export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = z.object({ ids: z.array(z.string()).max(500).optional() }).parse(await request.json().catch(() => ({})));
    await prisma.alert.updateMany({ where: { readAt: null, ...(body.ids && { id: { in: body.ids } }) }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
