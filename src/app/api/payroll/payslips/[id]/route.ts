import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";

/** Undo a salary paid by mistake: its expense goes, and the advances it took back are owed again. */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const slip = await prisma.payslip.findFirst({ where: { id } });
    if (!slip) fail("Salary not found", 404);
    const later = await prisma.payslip.findFirst({ where: { employeeId: slip.employeeId, month: { gt: slip.month } } });
    if (later) fail("A later month is already paid. Undo that one first.");
    await prisma.$transaction(async (tx) => {
      // An advance carried over from this salary is dropped: the original advances are owed again.
      await tx.salaryAdvance.deleteMany({ where: { employeeId: slip.employeeId, payslipId: null, expenseId: null, note: `Left over from ${slip.month}` } });
      await tx.salaryAdvance.updateMany({ where: { payslipId: slip.id }, data: { payslipId: null } });
      if (slip.expenseId) await tx.expense.deleteMany({ where: { id: slip.expenseId } });
      await tx.payslip.delete({ where: { id } });
    });
    await logActivity(user, "Undid salary", `${slip.employeeName} for ${slip.month}`);
    return NextResponse.json({ success: true });
  });
}
