import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { SALARY_EXPENSE_CATEGORY, payslipSchema, salaryFor } from "@/lib/payroll";
import { formatCurrency, label } from "@/lib/utils";

/**
 * Pays one employee's salary for a month: takes back their advances, saves the money paid as an
 * expense, and keeps the payslip. An advance bigger than the pay carries over to next month.
 */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = payslipSchema.parse(await request.json());
    const settings = await getSettings();
    const employee = await prisma.employee.findFirst({ where: { id: body.employeeId } });
    if (!employee) fail("Employee not found", 404);
    if (await prisma.payslip.findFirst({ where: { employeeId: employee.id, month: body.month } })) fail(`${employee.name}'s salary for this month is already paid.`);
    const today = todayKey(settings.timezone);
    if (body.month > today.slice(0, 7)) fail("You can't pay a month that hasn't started.");

    const payslip = await prisma.$transaction(async (tx) => {
      const open = await tx.salaryAdvance.findMany({ where: { employeeId: employee.id, payslipId: null } });
      const owed = open.reduce((s, a) => s + a.amount, 0);
      const pay = salaryFor({ payType: employee.payType, rate: employee.salary, month: body.month, daysWorked: body.daysWorked, paidLeaves: body.paidLeaves, bonus: body.bonus, deductions: body.deductions, advances: owed });
      const expense =
        pay.net > 0
          ? await tx.expense.create({
              data: { restaurantId: settings.restaurantId, date: today, category: SALARY_EXPENSE_CATEGORY, amount: pay.net, method: body.method, paidTo: employee.name, notes: `Salary for ${body.month}`, createdById: user.id, createdByName: user.name },
            })
          : null;
      const slip = await tx.payslip.create({
        data: {
          restaurantId: settings.restaurantId,
          employeeId: employee.id,
          employeeName: employee.name,
          month: body.month,
          payType: employee.payType,
          rate: employee.salary,
          daysWorked: body.daysWorked,
          paidLeaves: body.paidLeaves,
          payDays: pay.payDays,
          gross: pay.gross,
          bonus: pay.bonus,
          deductions: pay.deductions,
          advances: pay.advances,
          net: pay.net,
          method: body.method,
          paidOn: today,
          note: body.note || null,
          expenseId: expense?.id ?? null,
          createdByName: user.name,
        },
      });
      if (open.length) await tx.salaryAdvance.updateMany({ where: { id: { in: open.map((a) => a.id) } }, data: { payslipId: slip.id } });
      if (pay.advanceLeft > 0) {
        await tx.salaryAdvance.create({
          data: { restaurantId: settings.restaurantId, employeeId: employee.id, date: today, amount: pay.advanceLeft, method: "cash", note: `Left over from ${body.month}`, createdByName: user.name },
        });
      }
      return slip;
    });
    await logActivity(user, "Paid salary", `${employee.name} for ${body.month}: ${formatCurrency(payslip.net, settings.currency)} by ${label(payslip.method)}`);
    return NextResponse.json({ payslip }, { status: 201 });
  });
}
