// Taking payment and closing a bill: used by the counter, the Razorpay UPI QR (when the guest
// pays) and bills synced from a counter that was offline.
import { z } from "zod";
import { prisma } from "./db";
import { fail } from "./api";
import { logActivity } from "./activity";
import { getSettings } from "./settings";
import { round2 } from "./billing";
import { todayKey } from "./dates";
import { addAccountEntry, normalizePhone, recordVisit } from "./customers";
import { takeStockForOrder } from "./stock";
import { activeItems, assertEditable, loadOrder, nextNumber, saveTotals, sendUnsentToKitchen, totalsOf } from "./orders";
import { PAYMENT_METHODS, formatCurrency, label } from "./utils";
import { can } from "./permissions";
import { changesAfterPrint, raiseAlert } from "./alerts";
import type { SessionUser } from "./session";

export const paymentsSchema = z
  .array(
    z.object({
      method: z.enum(PAYMENT_METHODS),
      amount: z.coerce.number().positive("Each payment needs an amount").max(100_000_000),
      reference: z.string().trim().max(100).optional().nullable(),
    })
  )
  .max(10);

/** Who took the payment: a signed-in person, or the system (id null) for a UPI QR the guest paid. */
type Who = Pick<SessionUser, "name" | "role" | "permissions"> & { id: string | null };

/** Takes payment (cash, UPI, card or a mix) and closes the bill. The table becomes free. */
export async function settleOrder(user: Who, id: string, payments: z.infer<typeof paymentsSchema>, opts: { expectTotal?: number } = {}) {
  const body = { payments };
  const settings = await getSettings();
  const order = await loadOrder(id);
  if (opts.expectTotal !== undefined && Math.abs(totalsOf(order).total - opts.expectTotal) > 0.01) fail("The bill changed after the QR code was made. Show a new QR code.");
  assertEditable(order);
  if (activeItems(order.items).length === 0) fail("Add items before taking payment");

  const total = totalsOf(order).total;
  const offer = order.offerId ? await prisma.offer.findFirst({ where: { id: order.offerId } }) : null;
  if (offer && totalsOf(order).itemsTotal < offer.minBill) {
    fail(`The offer “${offer.name}” needs a bill of ${formatCurrency(offer.minBill, settings.currency)}. Add items or take the offer off.`);
  }
  const paying = round2(body.payments.reduce((sum, p) => sum + p.amount, 0));
  if (Math.abs(paying - total) > 0.01) {
    fail(
      paying < total
        ? `${formatCurrency(round2(total - paying), settings.currency)} is still to be paid`
        : `The payments add up to ${formatCurrency(round2(paying - total), settings.currency)} more than the bill`
    );
  }

  const onAccount = round2(body.payments.filter((p) => p.method === "account").reduce((sum, p) => sum + p.amount, 0));
  if (onAccount > 0 && !normalizePhone(order.customerPhone)) fail("Add the customer's phone number to put the bill on their account.");

  const result = await prisma.$transaction(async (tx) => {
    const kotNumber = await sendUnsentToKitchen(tx, id);
    const billNumber = order.billNumber ?? `${settings.billPrefix}${await nextNumber(tx, "billSeq")}`;
    if (body.payments.length) {
      await tx.payment.createMany({
        data: body.payments.map((p) => ({ restaurantId: settings.restaurantId, orderId: id, method: p.method, amount: round2(p.amount), reference: p.reference || null, receivedBy: user.name })),
      });
    }
    const now = new Date();
    const visit = await recordVisit(tx, order, total, settings);
    if (onAccount > 0 && visit.customerId) {
      await addAccountEntry(
        tx,
        { customerId: visit.customerId, type: "bill", amount: -onAccount, orderId: id, billNumber, date: todayKey(settings.timezone), createdByName: user.name },
        { mayGiveCredit: can(user, "payLater") }
      );
    }
    if (offer) await tx.offer.update({ where: { id: offer.id }, data: { timesUsed: { increment: 1 } } });
    await takeStockForOrder(tx, { ...(await loadOrder(id, tx)), billNumber }, todayKey(settings.timezone), user.name);
    const updated = await saveTotals(tx, await loadOrder(id, tx), {
      ...visit.data,
      status: "settled",
      billNumber,
      billedAt: order.billedAt ?? now,
      settledAt: now,
      businessDate: todayKey(settings.timezone),
      activeTable: { disconnect: true },
    });
    return { order: updated, kotNumber };
  });
  const how = body.payments.map((p) => `${label(p.method)} ${formatCurrency(p.amount, settings.currency)}`).join(" + ") || "nothing to pay";
  await logActivity(user, "Took payment", `Bill ${result.order.billNumber} (order #${order.number}): ${how}`);

  await alertsAfterPayment(user, result.order);
  return result;
}

/** A bill paid for less than printed, or with a big discount / on the house: tell the owner. */
async function alertsAfterPayment(user: Who, order: Awaited<ReturnType<typeof loadOrder>>) {
  const t = totalsOf(order);
  if (order.printedTotal && t.total < order.printedTotal - 0.5) {
    const printed = await prisma.activityLog.findFirst({ where: { action: "Printed bill", details: { contains: `order #${order.number}:` } }, orderBy: { createdAt: "asc" } });
    const changes = await changesAfterPrint(order.number, printed?.createdAt ?? order.createdAt);
    const less = order.printedTotal - t.total;
    await raiseAlert(user, (_, currency) => ({
      kind: "bill_changed",
      title: "Bill changed after printing",
      message: `Bill ${order.billNumber}${order.table ? ` (${order.table.name})` : ""} was printed for ${formatCurrency(order.printedTotal!, currency)} but paid ${formatCurrency(t.total, currency)} — ${formatCurrency(less, currency)} less.${changes.length ? ` Changes: ${changes.join("; ")}.` : ""}`,
      orderId: order.id,
      amount: less,
    }));
  }
  if (order.complimentary) {
    await raiseAlert(user, (_, currency) => ({
      kind: "complimentary",
      title: "Complimentary bill",
      message: `Bill ${order.billNumber}${order.table ? ` (${order.table.name})` : ""} worth ${formatCurrency(t.itemsTotal, currency)} was given on the house${order.discountReason ? `: ${order.discountReason}` : ""}.`,
      orderId: order.id,
      amount: t.itemsTotal,
    }));
  } else if (t.discount - t.pointsDiscount > 0 && t.itemsTotal > 0) {
    const off = t.discount - t.pointsDiscount;
    const pct = (off / t.itemsTotal) * 100;
    await raiseAlert(user, (rules, currency) =>
      pct + 0.001 < rules.discountPercent
        ? null
        : {
            kind: "discount",
            title: `${Math.round(pct)}% discount`,
            message: `Bill ${order.billNumber}${order.table ? ` (${order.table.name})` : ""}: ${formatCurrency(off, currency)} off ${formatCurrency(t.itemsTotal, currency)}${order.discountReason ? ` — reason: ${order.discountReason}` : ""}. Paid ${formatCurrency(t.total, currency)}.`,
            orderId: order.id,
            amount: off,
          }
    );
  }
}
