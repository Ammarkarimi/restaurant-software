import { NextRequest, NextResponse } from "next/server";
import { currentRestaurantId, prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { offerData, offerSchema, offerValue } from "@/lib/offers";

/** Saved offers, for the discount button on the order screen and the Menu → Offers tab. */
export async function GET() {
  return withAuth(async () => {
    const offers = await prisma.offer.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json({ offers });
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = offerSchema.parse(await request.json());
    if (body.code && (await prisma.offer.findFirst({ where: { code: { equals: body.code, mode: "insensitive" } } }))) fail(`Another offer already uses the code ${body.code}`);
    const offer = await prisma.offer.create({ data: { restaurantId: currentRestaurantId(), ...offerData(body) } });
    await logActivity(user, "Added offer", `${offer.name}: ${offerValue(offer)}${offer.code ? ` (code ${offer.code})` : ""}`);
    return NextResponse.json({ offer }, { status: 201 });
  });
}
