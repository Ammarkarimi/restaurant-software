import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/utils";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const expense = await prisma.expense.findFirst({ where: { id } });
    if (!expense) fail("Expense not found", 404);
    await prisma.expense.delete({ where: { id } });
    await logActivity(user, "Deleted expense", `${expense.category}: ${formatCurrency(expense.amount)} on ${expense.date}`);
    return NextResponse.json({ success: true });
  });
}
