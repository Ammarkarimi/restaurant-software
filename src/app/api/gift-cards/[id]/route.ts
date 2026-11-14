import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { formatCurrency, label } from "@/lib/utils";

/** One card with everything it paid for. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const card = await prisma.giftCard.findFirst({ where: { id }, include: { txns: { orderBy: { createdAt: "asc" } } } });
    if (!card) fail("Gift card not found", 404);
    return NextResponse.json({ card });
  });
}

const cancelSchema = z.object({
  reason: z.string().trim().min(2, "Give a reason").max(200),
  // Money given back to the buyer, saved as today's expense so the drawer adds up.
  refund: z.coerce.number().min(0).max(1_000_000).default(0),
  refundMethod: z.enum(["cash", "upi", "card", "bank"]).default("cash"),
});

/** Cancels a card (lost, sold by mistake, money returned). Only the owner / manager. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = cancelSchema.parse(await request.json());
    const settings = await getSettings();
    const card = await prisma.giftCard.findFirst({ where: { id } });
    if (!card) fail("Gift card not found", 404);
    if (card.status !== "active") fail("This card is already cancelled.");
    if (body.refund > card.balance + 0.001) fail(`Only ${formatCurrency(card.balance, settings.currency)} is left on this card.`);
    const date = todayKey(settings.timezone);
    await prisma.$transaction(async (tx) => {
      await tx.giftCard.update({ where: { id }, data: { status: "cancelled", balance: 0 } });
      await tx.giftCardTxn.create({ data: { restaurantId: card.restaurantId, giftCardId: id, type: "cancelled", amount: -card.balance, balance: 0, date, createdByName: user.name } });
      if (body.refund > 0) {
        await tx.expense.create({
          data: { restaurantId: card.restaurantId, date, category: "Other", amount: round2(body.refund), method: body.refundMethod, paidTo: card.buyerName, notes: `Gift card ${card.code} refunded: ${body.reason}`, createdById: user.id, createdByName: user.name },
        });
      }
    });
    await logActivity(user, "Cancelled gift card", `${card.code} with ${formatCurrency(card.balance, settings.currency)} left: ${body.reason}${body.refund ? `; gave back ${formatCurrency(body.refund, settings.currency)} by ${label(body.refundMethod)}` : ""}`);
    return NextResponse.json({ success: true });
  });
}
