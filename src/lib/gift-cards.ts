// Gift cards: a guest pays now and the card (or whoever they give it to) spends it on bills later.
// The money is not a sale when the card is sold; it becomes a sale when the card pays a bill.
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { Db } from "./db";
import { fail } from "./api";
import { round2 } from "./billing";

// No 0/O, 1/I/L: codes are read out loud and typed in by hand.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newGiftCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `GC-${part()}-${part()}`;
}

/** "gc 7k3m 9q2p" or "7K3M9Q2P" → "GC-7K3M-9Q2P". */
export function normalizeGiftCode(input: string | null | undefined): string {
  const raw = (input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^GC/, "");
  return raw.length === 8 ? `GC-${raw.slice(0, 4)}-${raw.slice(4)}` : (input ?? "").trim().toUpperCase();
}

export function giftCardProblem(card: { status: string; balance: number; expiresOn: string | null }, today: string, amount = 0): string | null {
  if (card.status !== "active") return "This gift card was cancelled.";
  if (card.expiresOn && card.expiresOn < today) return `This gift card expired on ${card.expiresOn}.`;
  if (card.balance <= 0) return "This gift card has nothing left on it.";
  if (amount > card.balance + 0.001) return `This gift card has only ${card.balance} left.`;
  return null;
}

export const giftCardSchema = z.object({
  amount: z.coerce.number().min(1, "Enter the card's value").max(1_000_000),
  method: z.enum(["cash", "upi", "card"]).default("cash"),
  buyerName: z.string().trim().max(80).nullable().optional(),
  buyerPhone: z.string().trim().max(20).nullable().optional(),
  recipientName: z.string().trim().max(80).nullable().optional(),
  message: z.string().trim().max(200).nullable().optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
});

/** Takes gift card payments off their cards. Runs inside the payment's transaction. */
export async function redeemGiftCards(
  tx: Db,
  payments: Array<{ method: string; amount: number; reference?: string | null }>,
  ctx: { orderId: string; billNumber: string | null; date: string; by: string }
) {
  for (const p of payments) {
    if (p.method !== "gift_card") continue;
    const code = normalizeGiftCode(p.reference);
    if (!code) fail("Enter the gift card's code.");
    const card = await tx.giftCard.findFirst({ where: { code } });
    if (!card) fail(`Gift card ${code} was not found.`);
    const problem = giftCardProblem(card, ctx.date, p.amount);
    if (problem) fail(`${code}: ${problem}`);
    // Only takes the money if the balance is still there (two counters using one card at once).
    const taken = await tx.giftCard.updateMany({ where: { id: card.id, balance: { gte: round2(p.amount) - 0.001 } }, data: { balance: { decrement: round2(p.amount) } } });
    if (taken.count !== 1) fail(`${code}: the balance just changed. Check it again.`);
    const after = await tx.giftCard.findUniqueOrThrow({ where: { id: card.id } });
    await tx.giftCardTxn.create({
      data: { restaurantId: card.restaurantId, giftCardId: card.id, type: "redeemed", amount: -round2(p.amount), balance: round2(after.balance), orderId: ctx.orderId, billNumber: ctx.billNumber, date: ctx.date, createdByName: ctx.by },
    });
    p.reference = code;
  }
}

/** Puts gift card money back: the bill was cancelled, or how it was paid was changed. */
export async function refundGiftCards(tx: Db, payments: Array<{ method: string; amount: number; reference: string | null }>, ctx: { orderId: string; billNumber: string | null; date: string; by: string }) {
  for (const p of payments) {
    if (p.method !== "gift_card" || !p.reference) continue;
    const card = await tx.giftCard.findFirst({ where: { code: p.reference } });
    if (!card) continue;
    const after = await tx.giftCard.update({ where: { id: card.id }, data: { balance: { increment: round2(p.amount) } } });
    await tx.giftCardTxn.create({
      data: { restaurantId: card.restaurantId, giftCardId: card.id, type: "refund", amount: round2(p.amount), balance: round2(after.balance), orderId: ctx.orderId, billNumber: ctx.billNumber, date: ctx.date, createdByName: ctx.by },
    });
  }
}
