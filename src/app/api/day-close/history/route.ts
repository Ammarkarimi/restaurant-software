import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/api";

/** The last closed days, newest first. */
export async function GET() {
  return withAdmin(async () => {
    const closes = await prisma.dayClose.findMany({
      orderBy: { date: "desc" },
      take: 90,
      select: { id: true, date: true, sales: true, bills: true, cashSales: true, cashExpenses: true, expectedCash: true, countedCash: true, difference: true, closedByName: true, closedAt: true },
    });
    return NextResponse.json({ closes });
  });
}
