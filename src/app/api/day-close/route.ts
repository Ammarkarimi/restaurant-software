import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, withAdmin } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { isDateKey, todayKey } from "@/lib/dates";
import { round2 } from "@/lib/billing";
import { daySummary, type DaySummaryJson } from "@/lib/cash";
import { formatCurrency } from "@/lib/utils";

/** The day's sales, expenses and cash drawer, for closing the day. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const settings = await getSettings();
    const date = new URL(request.url).searchParams.get("date");
    return NextResponse.json({ summary: await daySummary(isDateKey(date) ? date : todayKey(settings.timezone)) });
  });
}

const schema = z.object({
  date: z.string().refine(isDateKey, "Choose a date"),
  openingCash: z.coerce.number().min(0).max(100_000_000),
  countedCash: z.coerce.number().min(0).max(100_000_000),
  cashLeft: z.coerce.number().min(0).max(100_000_000),
  notes: z.string().trim().max(500).optional().nullable(),
});

/** Closes the day (or corrects a closed day): saves the cash count and a summary of the day. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const body = schema.parse(await request.json());
    const settings = await getSettings();
    if (body.date > todayKey(settings.timezone)) fail("You cannot close a day in the future");
    if (body.cashLeft > body.countedCash) fail("Cash left for tomorrow cannot be more than the cash counted");
    const s = await daySummary(body.date);
    const expectedCash = round2(body.openingCash + s.cashSales + s.cashReceived - s.cashExpenses);
    const summary: DaySummaryJson = {
      payments: s.payments,
      received: s.received,
      expenses: s.expensesByCategory,
      discount: s.discount,
      tax: s.tax,
      cancelled: s.cancelled,
    };
    const data = {
      openingCash: round2(body.openingCash),
      cashSales: s.cashSales,
      cashExpenses: s.cashExpenses,
      expectedCash,
      countedCash: round2(body.countedCash),
      difference: round2(body.countedCash - expectedCash),
      cashLeft: round2(body.cashLeft),
      sales: s.sales,
      bills: s.bills,
      summary: JSON.stringify(summary),
      notes: body.notes || null,
      closedById: user.id,
      closedByName: user.name,
      closedAt: new Date(),
    };
    const close = await prisma.dayClose.upsert({
      where: { restaurantId_date: { restaurantId: settings.restaurantId, date: body.date } },
      create: { restaurantId: settings.restaurantId, date: body.date, ...data },
      update: data,
    });
    const diff = close.difference === 0 ? "cash matches" : `${close.difference < 0 ? "short" : "extra"} ${formatCurrency(Math.abs(close.difference), settings.currency)}`;
    await logActivity(user, s.close ? "Corrected day close" : "Closed the day", `${body.date}: sales ${formatCurrency(close.sales, settings.currency)}, ${diff}`);
    return NextResponse.json({ summary: await daySummary(body.date) });
  });
}
