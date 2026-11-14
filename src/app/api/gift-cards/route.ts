import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { giftCardSchema, newGiftCode, normalizeGiftCode } from "@/lib/gift-cards";
import { formatCurrency, label } from "@/lib/utils";

/** Gift cards, newest first; ?q= finds a code, name or phone. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const settings = await getSettings();
    const where: Prisma.GiftCardWhereInput = q
      ? { OR: [{ code: { contains: normalizeGiftCode(q) } }, { code: { contains: q.toUpperCase() } }, { buyerName: { contains: q, mode: "insensitive" } }, { recipientName: { contains: q, mode: "insensitive" } }, { buyerPhone: { contains: q.replace(/\D/g, "") || q } }] }
      : {};
    const [cards, open] = await Promise.all([
      prisma.giftCard.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.giftCard.aggregate({ where: { status: "active", balance: { gt: 0 }, OR: [{ expiresOn: null }, { expiresOn: { gte: todayKey(settings.timezone) } }] }, _sum: { balance: true }, _count: true }),
    ]);
    return NextResponse.json({ cards, today: todayKey(settings.timezone), unspent: { count: open._count, amount: round2(open._sum.balance ?? 0) } });
  });
}

/** Sells a gift card. The money is counted in today's cash / UPI, but not as a sale. */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = giftCardSchema.parse(await request.json());
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    if (body.expiresOn && body.expiresOn < today) fail("The expiry date has passed");
    let card = null;
    for (let i = 0; i < 5 && !card; i++) {
      const code = newGiftCode();
      if (await prisma.giftCard.findFirst({ where: { code } })) continue;
      card = await prisma.$transaction(async (tx) => {
        const c = await tx.giftCard.create({
          data: {
            restaurantId: settings.restaurantId,
            code,
            amount: round2(body.amount),
            balance: round2(body.amount),
            buyerName: body.buyerName || null,
            buyerPhone: body.buyerPhone?.replace(/[^\d+]/g, "") || null,
            recipientName: body.recipientName || null,
            message: body.message || null,
            expiresOn: body.expiresOn || null,
            soldMethod: body.method,
            soldOn: today,
            soldByName: user.name,
          },
        });
        await tx.giftCardTxn.create({ data: { restaurantId: c.restaurantId, giftCardId: c.id, type: "sold", amount: c.amount, balance: c.amount, date: today, createdByName: user.name } });
        return c;
      });
    }
    if (!card) fail("Could not make a card number. Please try again.");
    await logActivity(user, "Sold gift card", `${card.code}: ${formatCurrency(card.amount, settings.currency)} by ${label(card.soldMethod)}${card.buyerName ? ` to ${card.buyerName}` : ""}`);
    return NextResponse.json({ card }, { status: 201 });
  });
}
