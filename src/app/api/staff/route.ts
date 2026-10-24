import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentRestaurantId, prisma, rawPrisma } from "@/lib/db";
import { withAdmin, fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const publicFields = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export async function GET() {
  return withAdmin(async () => {
    const staff = await prisma.staff.findMany({ orderBy: { createdAt: "asc" }, select: publicFields });
    return NextResponse.json(staff);
  });
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email (used to sign in)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "staff", "kitchen"]).default("staff"),
});

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    // Sign-in emails are unique across every restaurant using the software.
    const existing = await rawPrisma.staff.findUnique({ where: { email: body.email } });
    if (existing) fail("Someone already uses this email to sign in");
    const staff = await prisma.staff.create({
      data: { restaurantId: currentRestaurantId(), name: body.name, email: body.email, role: body.role, passwordHash: await hashPassword(body.password) },
      select: publicFields,
    });
    await logActivity(user, "Staff account added", `${staff.name} (${staff.role})`);
    return NextResponse.json(staff, { status: 201 });
  });
}
