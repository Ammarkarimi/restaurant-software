import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { employeeSchema } from "@/lib/payroll";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = employeeSchema.parse(await request.json());
    const found = await prisma.employee.findFirst({ where: { id } });
    if (!found) fail("Employee not found", 404);
    if (body.staffId && !(await prisma.staff.findFirst({ where: { id: body.staffId } }))) fail("That sign-in was not found");
    const employee = await prisma.employee.update({
      where: { id },
      data: { ...body, staffId: body.staffId || null, joinedOn: body.joinedOn || null, phone: body.phone || null, job: body.job || null, notes: body.notes || null },
    });
    await logActivity(user, "Changed employee", employee.name);
    return NextResponse.json({ employee });
  });
}

/** Removes someone who was never paid through the app; otherwise they are only marked as left. */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const found = await prisma.employee.findFirst({ where: { id }, include: { _count: { select: { payslips: true, advances: true } } } });
    if (!found) fail("Employee not found", 404);
    if (found._count.payslips || found._count.advances) {
      await prisma.employee.update({ where: { id }, data: { active: false } });
      await logActivity(user, "Employee left", found.name);
      return NextResponse.json({ removed: false });
    }
    await prisma.employee.delete({ where: { id } });
    await logActivity(user, "Removed employee", found.name);
    return NextResponse.json({ removed: true });
  });
}
