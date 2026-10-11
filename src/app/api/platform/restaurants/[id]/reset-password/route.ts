import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rawPrisma, runForRestaurant } from "@/lib/db";
import { fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { generatePassword, withPlatform } from "@/lib/platform";

/** Gives one of a restaurant's sign-ins a new temporary password, for when it is forgotten. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withPlatform(async () => {
    const { id } = await params;
    const { staffId } = z.object({ staffId: z.string().min(1) }).parse(await request.json());
    const staff = await rawPrisma.staff.findFirst({ where: { id: staffId, restaurantId: id } });
    if (!staff) fail("Sign-in account not found", 404);
    const password = generatePassword();
    await rawPrisma.staff.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(password), active: true } });
    await runForRestaurant(id, () => logActivity(null, "Password reset by software provider", staff.name));
    return NextResponse.json({ email: staff.email, name: staff.name, password });
  });
}
