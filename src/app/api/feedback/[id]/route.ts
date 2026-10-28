import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

/** The owner called the guest back about their rating. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const { followedUp } = z.object({ followedUp: z.boolean() }).parse(await request.json());
    const f = await prisma.feedback.findFirst({ where: { id } });
    if (!f) fail("Feedback not found", 404);
    await prisma.feedback.update({ where: { id }, data: { followedUp } });
    if (followedUp) await logActivity(user, "Followed up feedback", `${f.name ?? f.phone ?? "Guest"}: ${f.rating} stars`);
    return NextResponse.json({ success: true });
  });
}
