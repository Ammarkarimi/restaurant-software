import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { parseRecipients } from "@/lib/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({ where: { id } });
    if (!campaign) fail("Not found", 404);
    return NextResponse.json({ campaign: { ...campaign, recipients: parseRecipients(campaign.recipients) } });
  });
}

/** Marks a customer as sent (after the WhatsApp tap). */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withAdmin(async () => {
    const { id } = await params;
    const { customerId, sent } = z.object({ customerId: z.string().min(1).max(40), sent: z.boolean().default(true) }).parse(await request.json());
    const campaign = await prisma.campaign.findFirst({ where: { id } });
    if (!campaign) fail("Not found", 404);
    const list = parseRecipients(campaign.recipients).map((r) => (r.customerId === customerId ? { ...r, sentAt: sent ? new Date().toISOString() : null } : r));
    await prisma.campaign.update({ where: { id }, data: { recipients: JSON.stringify(list) } });
    return NextResponse.json({ sent: list.filter((r) => r.sentAt).length });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({ where: { id } });
    if (!campaign) fail("Not found", 404);
    await prisma.campaign.delete({ where: { id } });
    await logActivity(user, "Deleted WhatsApp offer", campaign.name);
    return NextResponse.json({ success: true });
  });
}
