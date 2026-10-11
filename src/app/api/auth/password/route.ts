import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = schema.parse(await request.json());
    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(body.currentPassword, staff.passwordHash))) fail("Your current password is not correct");
    await prisma.staff.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    await logActivity(user, "Changed own password");
    return NextResponse.json({ success: true });
  });
}
