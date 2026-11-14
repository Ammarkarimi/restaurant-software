import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { salaryFor } from "@/lib/payroll";

/**
 * The salary sheet for a month (?month=YYYY-MM): every employee with the days their shifts show,
 * advances still to take back, and the salary already paid.
 */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const settings = await getSettings();
    const month = new URL(request.url).searchParams.get("month") ?? todayKey(settings.timezone).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) fail("Choose a month");
    const [employees, attendance, advances, payslips, staff] = await Promise.all([
      prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.attendance.findMany({ where: { date: { gte: `${month}-01`, lte: `${month}-31` } }, select: { staffId: true, date: true } }),
      prisma.salaryAdvance.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.payslip.findMany({ where: { month }, orderBy: { employeeName: "asc" } }),
      prisma.staff.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    ]);
    const days = new Map<string, Set<string>>();
    for (const a of attendance) {
      const set = days.get(a.staffId) ?? new Set<string>();
      set.add(a.date);
      days.set(a.staffId, set);
    }
    const sheet = employees
      .filter((e) => e.active || payslips.some((p) => p.employeeId === e.id))
      .map((e) => {
        const owed = advances.filter((a) => a.employeeId === e.id && !a.payslipId).reduce((s, a) => s + a.amount, 0);
        const shiftDays = e.staffId ? (days.get(e.staffId)?.size ?? 0) : null;
        const paid = payslips.find((p) => p.employeeId === e.id) ?? null;
        return {
          employee: e,
          shiftDays,
          advancesOwed: Math.round(owed * 100) / 100,
          paid,
          // A first guess the owner can change: shift days when they sign in, else the whole month.
          suggestion: salaryFor({ payType: e.payType, rate: e.salary, month, daysWorked: shiftDays ?? (e.payType === "daily" ? 0 : 31), paidLeaves: e.payType === "daily" ? 0 : e.paidLeaves, advances: owed }),
        };
      });
    return NextResponse.json({
      month,
      sheet,
      advances: advances.slice(0, 200).map((a) => ({ ...a, employeeName: employees.find((e) => e.id === a.employeeId)?.name ?? "" })),
      staff,
      totals: {
        paid: Math.round(payslips.reduce((s, p) => s + p.net, 0) * 100) / 100,
        advancesOwed: Math.round(advances.filter((a) => !a.payslipId).reduce((s, a) => s + a.amount, 0) * 100) / 100,
      },
    });
  });
}
