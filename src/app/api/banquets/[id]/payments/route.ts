import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { banquetPaymentSchema } from "@/lib/banquet";
import { assertBanquetAccess, loadEvent, serializeEvent } from "@/lib/banquet-server";
import { formatCurrency, label } from "@/lib/utils";

/** Advance, part or final payment for a function (a negative amount is a refund). Counts in today's cash. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const { id } = await params;
    const body = banquetPaymentSchema.parse(await request.json());
    const settings = await getSettings();
    const event = serializeEvent(await loadEvent(id));
    if (body.amount < 0 && -body.amount > event.paid + 0.01) fail(`Only ${formatCurrency(event.paid, settings.currency)} was paid, so the refund can't be more.`);
    if (body.amount > 0 && event.status === "cancelled") fail("This booking is cancelled. Open it again before taking money.");
    await prisma.banquetPayment.create({
      data: { restaurantId: settings.restaurantId, eventId: id, amount: body.amount, method: body.method, reference: body.reference || null, note: body.note || null, date: todayKey(settings.timezone), receivedBy: user.name },
    });
    const updated = serializeEvent(await loadEvent(id));
    await logActivity(user, body.amount < 0 ? "Banquet refund" : "Banquet payment", `#${event.number} ${event.customerName}: ${label(body.method)} ${formatCurrency(Math.abs(body.amount), settings.currency)}${updated.balance > 0 ? `, ${formatCurrency(updated.balance, settings.currency)} left` : ""}`);
    return NextResponse.json({ event: updated }, { status: 201 });
  });
}
