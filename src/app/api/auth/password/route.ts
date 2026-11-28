import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma } from "@/lib/db";
import { withAuth, fail } from "@/lib/api";
import { COOKIE_NAME, SESSION_DURATION, createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200, "Password is too long"),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = schema.parse(await request.json());
    // Own account: may belong to another outlet when an owner works across outlets.
    const staff = await rawPrisma.staff.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(body.currentPassword, staff.passwordHash))) fail("Your current password is not correct");
    // Every other device signed in with the old password is signed out; this one gets a fresh sign-in.
    const updated = await rawPrisma.staff.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword), sessionVersion: { increment: 1 } } });
    await logActivity(user, "Changed own password");
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, await createSession({ ...user, v: updated.sessionVersion }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_DURATION, path: "/" });
    return response;
  }, { kitchen: true });
}
