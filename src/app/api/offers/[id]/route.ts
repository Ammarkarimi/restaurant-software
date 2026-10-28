import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { offerData, offerSchema, offerValue } from "@/lib/offers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = offerSchema.parse(await request.json());
    if (!(await prisma.offer.findFirst({ where: { id } }))) fail("Offer not found", 404);
    if (body.code && (await prisma.offer.findFirst({ where: { id: { not: id }, code: { equals: body.code, mode: "insensitive" } } }))) fail(`Another offer already uses the code ${body.code}`);
    const offer = await prisma.offer.update({ where: { id }, data: offerData(body) });
    await logActivity(user, "Edited offer", `${offer.name}: ${offerValue(offer)}`);
    return NextResponse.json({ offer });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const { active } = z.object({ active: z.boolean() }).parse(await request.json());
    const offer = await prisma.offer.findFirst({ where: { id } });
    if (!offer) fail("Offer not found", 404);
    await prisma.offer.update({ where: { id }, data: { active } });
    await logActivity(user, active ? "Switched on offer" : "Switched off offer", offer.name);
    return NextResponse.json({ success: true });
  });
}

/** Bills that used the offer keep their discount. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const offer = await prisma.offer.findFirst({ where: { id } });
    if (!offer) fail("Offer not found", 404);
    await prisma.offer.delete({ where: { id } });
    await logActivity(user, "Deleted offer", offer.name);
    return NextResponse.json({ success: true });
  });
}
