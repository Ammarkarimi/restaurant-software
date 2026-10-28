import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

/** Cancel a purchase order that has not arrived. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const { status } = z.object({ status: z.literal("cancelled") }).parse(await request.json());
    const purchase = await prisma.purchase.findFirst({ where: { id } });
    if (!purchase) fail("Purchase order not found", 404);
    if (purchase.status !== "ordered") fail("Only orders that have not arrived can be cancelled.");
    await prisma.purchase.update({ where: { id }, data: { status } });
    await logActivity(user, "Cancelled purchase order", `#${purchase.number} to ${purchase.supplierName}`);
    return NextResponse.json({ success: true });
  });
}
