import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { giftCardProblem, normalizeGiftCode } from "@/lib/gift-cards";

/** A card's balance, from its code, at the counter. */
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const code = normalizeGiftCode(new URL(request.url).searchParams.get("code"));
    const card = code ? await prisma.giftCard.findFirst({ where: { code }, select: { id: true, code: true, balance: true, amount: true, expiresOn: true, status: true, recipientName: true } }) : null;
    if (!card) return NextResponse.json({ error: "Gift card not found. Check the code." }, { status: 404 });
    const settings = await getSettings();
    return NextResponse.json({ card, problem: giftCardProblem(card, todayKey(settings.timezone)) });
  });
}
