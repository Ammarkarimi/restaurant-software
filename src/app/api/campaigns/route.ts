import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { SEGMENTS, parseRecipients, segmentCustomers, type SegmentId } from "@/lib/campaigns";

const segmentIds = SEGMENTS.map((s) => s.id) as [SegmentId, ...SegmentId[]];

/** Offer messages sent to customer groups, newest first. With ?segment=… just counts that group. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const segment = new URL(request.url).searchParams.get("segment");
    if (segment) {
      const parsed = z.enum(segmentIds).safeParse(segment);
      if (!parsed.success) fail("Unknown group");
      const settings = await getSettings();
      const people = await segmentCustomers(prisma, parsed.data, todayKey(settings.timezone));
      return NextResponse.json({ count: people.length, sample: people.slice(0, 5).map((p) => p.name || p.phone) });
    }
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({
      campaigns: campaigns.map(({ recipients, ...c }) => {
        const list = parseRecipients(recipients);
        return { ...c, total: list.length, sent: list.filter((r) => r.sentAt).length };
      }),
    });
  });
}

const schema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  segment: z.enum(segmentIds),
  message: z.string().trim().min(5, "Write the message").max(1000),
});

/** Saves the message and who gets it (the group as it is now). Sending is one WhatsApp tap per customer. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const recipients = await segmentCustomers(prisma, body.segment, todayKey(settings.timezone));
    if (recipients.length === 0) fail("Nobody is in this group right now");
    const campaign = await prisma.campaign.create({
      data: { restaurantId: settings.restaurantId, name: body.name, segment: body.segment, message: body.message, recipients: JSON.stringify(recipients), createdByName: user.name },
    });
    await logActivity(user, "Created WhatsApp offer", `${campaign.name} for ${recipients.length} customers`);
    return NextResponse.json({ campaign: { id: campaign.id } }, { status: 201 });
  });
}
