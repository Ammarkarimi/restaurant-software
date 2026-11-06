import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { loadEvent, serializeEvent } from "@/lib/banquet-server";
import { formatCurrency, label } from "@/lib/utils";

/** Removes a payment entered by mistake (owner / manager only; kept in the activity history). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  return withAdmin(async (user) => {
    const { id, paymentId } = await params;
    const payment = await prisma.banquetPayment.findFirst({ where: { id: paymentId, eventId: id } });
    if (!payment) fail("Payment not found", 404);
    const settings = await getSettings();
    const closed = await prisma.dayClose.findFirst({ where: { date: payment.date } });
    await prisma.banquetPayment.delete({ where: { id: paymentId } });
    const event = serializeEvent(await loadEvent(id));
    await logActivity(user, "Removed banquet payment", `#${event.number} ${event.customerName}: ${label(payment.method)} ${formatCurrency(payment.amount, settings.currency)} of ${payment.date}${closed ? " (that day was already closed)" : ""}`);
    return NextResponse.json({ event, dayClosed: !!closed });
  });
}
