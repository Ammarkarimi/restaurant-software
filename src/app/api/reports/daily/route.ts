import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { isDateKey, todayKey } from "@/lib/dates";
import { buildDailyReport, sendDailyReport } from "@/lib/daily-report";
import { logActivity } from "@/lib/activity";

/** The owner's daily report for one day, as text, with a WhatsApp link to send it by hand. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const settings = await getSettings();
    const date = new URL(request.url).searchParams.get("date");
    const report = await buildDailyReport(isDateKey(date) ? date : todayKey(settings.timezone));
    return NextResponse.json({ date: report.date, text: report.text, shareLink: report.shareLink });
  });
}

/** Sends the report now on WhatsApp / email (also used for "Send a test"). */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const settings = await getSettings();
    const body = z.object({ date: z.string().refine(isDateKey).optional() }).parse(await request.json().catch(() => ({})));
    if (!settings.alertPhone && !settings.alertEmail) fail("Add your WhatsApp number or email under Settings → Owner alerts first.");
    const date = body.date ?? todayKey(settings.timezone);
    const sentVia = await sendDailyReport(date, { force: true });
    if (!sentVia) fail("The report could not be sent: WhatsApp / email sending is not set up yet. Use “Send on WhatsApp” to send it from your phone.", 503);
    await logActivity(user, "Sent daily report", `${date} by ${sentVia.replace(",", " and ")}`);
    return NextResponse.json({ sentVia });
  });
}
