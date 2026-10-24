import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, isAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { diffDays, isDateKey, todayKey } from "@/lib/dates";
import { EXPENSE_METHODS } from "@/lib/cash";
import { formatCurrency, label } from "@/lib/utils";

/** Expenses for a period. Cashiers see today's only. */
export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const sp = new URL(request.url).searchParams;
    let from = isDateKey(sp.get("from")) ? sp.get("from")! : today;
    let to = isDateKey(sp.get("to")) ? sp.get("to")! : today;
    if (!isAdmin(user)) from = to = today;
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    const expenses = await prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1000 });
    return NextResponse.json({ expenses, from, to });
  });
}

const schema = z.object({
  date: z.string().refine(isDateKey, "Choose a date").optional(),
  category: z.string().trim().min(1, "Choose what it was for").max(60),
  amount: z.coerce.number().positive("Enter the amount").max(10_000_000),
  method: z.enum(EXPENSE_METHODS).default("cash"),
  paidTo: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
});

/** Records money paid out. Cashiers can record today's expenses (e.g. paying the vegetable seller from the till). */
export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const date = isAdmin(user) && body.date ? body.date : today;
    if (date > today) fail("An expense cannot be in the future");
    const closed = await prisma.dayClose.findFirst({ where: { date } });
    if (closed && !isAdmin(user)) fail("This day is already closed. Ask the owner / manager to add it.");
    const expense = await prisma.expense.create({
      data: {
        restaurantId: settings.restaurantId,
        date,
        category: body.category,
        amount: Math.round(body.amount * 100) / 100,
        method: body.method,
        paidTo: body.paidTo || null,
        notes: body.notes || null,
        createdById: user.id,
        createdByName: user.name,
      },
    });
    await logActivity(user, "Added expense", `${expense.category}: ${formatCurrency(expense.amount, settings.currency)} (${label(expense.method)})${expense.paidTo ? ` to ${expense.paidTo}` : ""}`);
    return NextResponse.json({ expense }, { status: 201 });
  });
}
