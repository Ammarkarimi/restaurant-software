import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { sendMissedReports } from "@/lib/daily-report";

export const maxDuration = 300;

/** The database (Neon) sleeps when idle; the first connection after that can fail while it wakes. */
function databaseWaking(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017", "P2024"].includes(error.code))
  );
}

/**
 * Runs once a day (vercel.json → crons). Sends yesterday's daily report to owners whose day was
 * not closed. Vercel calls it with "Authorization: Bearer $CRON_SECRET". Tried up to three times
 * if the database is still waking up; reports already sent are never sent twice.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const results = await sendMissedReports();
      return NextResponse.json({ sent: results.filter((r) => r.sentVia).length, checked: results.length, attempt });
    } catch (error) {
      if (!databaseWaking(error) || attempt >= 3) throw error;
      console.warn(`Daily job: database not reachable (attempt ${attempt}), trying again`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
}
