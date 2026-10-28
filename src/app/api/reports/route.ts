import { NextRequest, NextResponse } from "next/server";
import { fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, diffDays, isDateKey, todayKey } from "@/lib/dates";
import { parseCommission, salesReport } from "@/lib/reports";

export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const sp = new URL(request.url).searchParams;
    const settings = await getSettings();
    const today = todayKey(settings.timezone);
    const to = isDateKey(sp.get("to")) ? sp.get("to")! : today;
    const from = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(to, -6);
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    return NextResponse.json(await salesReport({ from, to, timezone: settings.timezone }, { commission: parseCommission(settings.appCommission) }));
  });
}
