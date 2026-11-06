import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { raiseAlert } from "@/lib/alerts";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { nextNumber } from "@/lib/orders";
import { BANQUET_STATUSES, NEXT_STATUS, STATUS_LABEL, type BanquetStatus } from "@/lib/banquet";
import { assertBanquetAccess, findClashes, loadEvent, saveEventTotal, serializeEvent, totalsOfEvent } from "@/lib/banquet-server";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({
  status: z.enum(BANQUET_STATUSES),
  reason: z.string().trim().max(200).optional(),
  finalGuests: z.coerce.number().int().min(0).max(10_000).optional(),
});

/**
 * Moves a booking along: enquiry → tentative (hold) → confirmed → completed (makes the invoice),
 * or cancelled (with a reason). Confirming refuses a hall that is already booked at that time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    assertBanquetAccess(user);
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const event = await loadEvent(id);
    const from = event.status as BanquetStatus;
    if (!NEXT_STATUS[from].includes(body.status)) fail(`A ${STATUS_LABEL[from].toLowerCase()} booking can't be marked ${STATUS_LABEL[body.status].toLowerCase()}.`);
    if (body.status === "cancelled" && !body.reason) fail("Please give a reason for cancelling");
    if ((body.status === "confirmed" || body.status === "tentative") && (await findClashes(event)).length) {
      fail("The hall is already booked at that time. Change the hall or time first.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { status: body.status };
      if (body.status === "cancelled") data.cancelReason = body.reason;
      if (body.status === "enquiry") data.cancelReason = null;
      if (body.status === "completed") {
        if (body.finalGuests !== undefined) data.finalGuests = body.finalGuests;
        data.invoiceNumber = event.invoiceNumber ?? `BQ-${await nextNumber(tx, "banquetInvoiceSeq")}`;
        data.invoicedAt = new Date();
        data.businessDate = todayKey(settings.timezone);
      }
      await tx.banquetEvent.update({ where: { id }, data });
      return saveEventTotal(tx, id);
    });

    const view = serializeEvent(updated);
    const what =
      body.status === "completed"
        ? `invoice ${updated.invoiceNumber}, ${formatCurrency(view.totals.total, settings.currency)}${view.balance > 0 ? `, ${formatCurrency(view.balance, settings.currency)} still to collect` : ""}`
        : body.status === "cancelled"
          ? `reason: ${body.reason}${view.paid > 0 ? ` (${formatCurrency(view.paid, settings.currency)} was paid)` : ""}`
          : STATUS_LABEL[body.status].toLowerCase();
    await logActivity(user, body.status === "completed" ? "Banquet invoiced" : body.status === "cancelled" ? "Banquet cancelled" : "Banquet status", `#${updated.number} ${updated.customerName}: ${what}`);

    // A big discount on a function is worth the owner's eye, like on a bill.
    if (body.status === "completed") {
      const t = totalsOfEvent(updated);
      const pct = t.subtotal ? (t.discount / t.subtotal) * 100 : 0;
      if (t.discount > 0) {
        await raiseAlert(user, (rules, currency) =>
          pct + 0.001 < rules.discountPercent
            ? null
            : { kind: "discount", title: `${Math.round(pct)}% discount on a banquet`, message: `Banquet ${updated.invoiceNumber} (${updated.customerName}, ${updated.eventType}): ${formatCurrency(t.discount, currency)} off ${formatCurrency(t.subtotal, currency)}. Invoice ${formatCurrency(t.total, currency)}.`, amount: t.discount }
        );
      }
    }
    if (body.status === "cancelled" && view.paid > 0) {
      await raiseAlert(user, (_, currency) => ({ kind: "order_cancel", title: "Banquet cancelled after advance", message: `Booking #${updated.number} (${updated.customerName}, ${updated.eventType} on ${updated.date}) was cancelled with ${formatCurrency(view.paid, currency)} paid. Reason: ${body.reason}.`, amount: view.paid }), { evenForManagers: true });
    }
    return NextResponse.json({ event: view });
  });
}
