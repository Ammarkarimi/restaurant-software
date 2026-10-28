import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { EXPENSE_METHODS } from "@/lib/cash";
import { formatCurrency, label } from "@/lib/utils";

const schema = z.object({
  amount: z.coerce.number().positive("Enter the amount").max(100_000_000),
  method: z.enum(EXPENSE_METHODS),
  note: z.string().trim().max(200).optional().nullable(),
});

/** Money paid to a supplier. Saved as an expense, so cash paid from the till counts in the day close. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const supplier = await prisma.supplier.findFirst({ where: { id } });
    if (!supplier) fail("Supplier not found", 404);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.expense.create({
        data: {
          restaurantId: settings.restaurantId,
          date: todayKey(settings.timezone),
          category: "Supplier payment",
          amount: round2(body.amount),
          method: body.method,
          paidTo: supplier.name,
          notes: body.note || null,
          supplierId: supplier.id,
          createdById: user.id,
          createdByName: user.name,
        },
      });
      return tx.supplier.update({ where: { id }, data: { balance: { decrement: round2(body.amount) } } });
    });
    await logActivity(user, "Paid supplier", `${supplier.name}: ${formatCurrency(body.amount, settings.currency)} by ${label(body.method)}, still owed ${formatCurrency(updated.balance, settings.currency)}`);
    return NextResponse.json({ supplier: updated });
  });
}
