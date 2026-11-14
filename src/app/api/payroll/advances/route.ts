import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { SALARY_EXPENSE_CATEGORY, advanceSchema } from "@/lib/payroll";
import { formatCurrency, label } from "@/lib/utils";

/** Money given before payday. Saved as today's expense too (cash ones come out of the till). */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = advanceSchema.parse(await request.json());
    const settings = await getSettings();
    const employee = await prisma.employee.findFirst({ where: { id: body.employeeId } });
    if (!employee) fail("Employee not found", 404);
    const date = todayKey(settings.timezone);
    const advance = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: { restaurantId: settings.restaurantId, date, category: SALARY_EXPENSE_CATEGORY, amount: round2(body.amount), method: body.method, paidTo: employee.name, notes: `Salary advance${body.note ? `: ${body.note}` : ""}`, createdById: user.id, createdByName: user.name },
      });
      return tx.salaryAdvance.create({
        data: { restaurantId: settings.restaurantId, employeeId: employee.id, date, amount: round2(body.amount), method: body.method, note: body.note || null, expenseId: expense.id, createdByName: user.name },
      });
    });
    await logActivity(user, "Salary advance", `${employee.name}: ${formatCurrency(advance.amount, settings.currency)} by ${label(advance.method)}`);
    return NextResponse.json({ advance }, { status: 201 });
  });
}

/** Undo an advance given by mistake (only before it was taken back from a salary). */
export async function DELETE(request: NextRequest) {
  return withAdmin(async (user) => {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const advance = await prisma.salaryAdvance.findFirst({ where: { id }, include: { employee: true } });
    if (!advance) fail("Advance not found", 404);
    if (advance.payslipId) fail("This advance was already taken back from a salary. Undo that salary first.");
    await prisma.$transaction(async (tx) => {
      if (advance.expenseId) await tx.expense.deleteMany({ where: { id: advance.expenseId } });
      await tx.salaryAdvance.delete({ where: { id } });
    });
    await logActivity(user, "Removed salary advance", `${advance.employee.name}: ${advance.amount}`);
    return NextResponse.json({ success: true });
  });
}
