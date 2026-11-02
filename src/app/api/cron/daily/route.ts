import { NextRequest, NextResponse } from "next/server";
import { sendMissedReports } from "@/lib/daily-report";

export const maxDuration = 300;

/**
 * Runs once a day (vercel.json → crons). Sends yesterday's daily report to owners whose day was
 * not closed. Vercel calls it with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const results = await sendMissedReports();
  return NextResponse.json({ sent: results.filter((r) => r.sentVia).length, checked: results.length });
}
