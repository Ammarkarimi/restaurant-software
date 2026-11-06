import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { banquetHallSchema } from "@/lib/banquet";

/** Edit a hall (switch it off instead of deleting, so old bookings keep their hall). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = banquetHallSchema.parse(await request.json());
    if (!(await prisma.banquetHall.findFirst({ where: { id } }))) fail("Hall not found", 404);
    const hall = await prisma.banquetHall.update({ where: { id }, data: { ...body, notes: body.notes || null } });
    await logActivity(user, "Edited banquet hall", hall.name);
    return NextResponse.json({ hall });
  });
}
