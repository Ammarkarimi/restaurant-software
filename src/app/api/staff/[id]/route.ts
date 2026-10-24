import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAdmin, fail } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(["admin", "staff", "kitchen"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

async function assertKeepsAnOwner(excludingId: string) {
  const owners = await prisma.staff.count({ where: { role: "admin", active: true, id: { not: excludingId } } });
  if (owners === 0) fail("There must always be at least one active owner / manager account");
}

export async function PUT(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const staff = await prisma.staff.findFirst({ where: { id } });
    if (!staff) fail("Staff member not found", 404);
    if (((body.role && body.role !== "admin") || body.active === false) && staff.role === "admin") await assertKeepsAnOwner(id);

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.role && { role: body.role }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.password && { passwordHash: await hashPassword(body.password) }),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    const what = [body.password && "password reset", body.role && `role ${body.role}`, body.active !== undefined && (body.active ? "enabled" : "disabled")]
      .filter(Boolean)
      .join(", ");
    await logActivity(user, "Staff account changed", `${updated.name}${what ? `: ${what}` : ""}`);
    return NextResponse.json(updated);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    if (id === user.id) fail("You cannot remove your own account");
    const staff = await prisma.staff.findFirst({ where: { id } });
    if (!staff) fail("Staff member not found", 404);
    if (staff.role === "admin") await assertKeepsAnOwner(id);
    await prisma.staff.delete({ where: { id } });
    await logActivity(user, "Staff account removed", staff.name);
    return NextResponse.json({ success: true });
  });
}
