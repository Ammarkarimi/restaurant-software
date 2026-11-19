import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { employeeSchema } from "@/lib/payroll";

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = employeeSchema.parse(await request.json());
    const settings = await getSettings();
    if (body.staffId && !(await prisma.staff.findFirst({ where: { id: body.staffId } }))) fail("That sign-in was not found");
    const employee = await prisma.employee.create({
      data: { ...body, restaurantId: settings.restaurantId, staffId: body.staffId || null, joinedOn: body.joinedOn || null, phone: body.phone || null, job: body.job || null, notes: body.notes || null },
    });
    await logActivity(user, "Added employee", `${employee.name}${employee.job ? ` (${employee.job})` : ""}`);
    return NextResponse.json({ employee }, { status: 201 });
  });
}
