import { NextRequest } from "next/server";
import { csvResponse, fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, diffDays, isDateKey, todayKey } from "@/lib/dates";
import { salesReport, settledOrders } from "@/lib/reports";
import { totalsOf } from "@/lib/orders";
import { label } from "@/lib/utils";

/** Downloads a spreadsheet (CSV) that opens in Excel or Google Sheets. */
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const sp = new URL(request.url).searchParams;
    const type = sp.get("type") || "bills";
    const settings = await getSettings();
    const to = isDateKey(sp.get("to")) ? sp.get("to")! : todayKey(settings.timezone);
    const from = isDateKey(sp.get("from")) ? sp.get("from")! : addDays(to, -6);
    if (to < from || diffDays(from, to) > 366) fail("Please choose a valid period of one year or less");
    const range = { from, to, timezone: settings.timezone };
    const suffix = `${from}_to_${to}.csv`;

    if (type === "bills") {
      const orders = await settledOrders(range);
      return csvResponse(`bills_${suffix}`, [
        ["Bill #", "Date", "Time", "Order #", "Type", "Order from", "App order ID", "Table", "Customer", "Phone", "Items", "Items total", "Discount", "Service charge", "Packing & delivery", "Taxable", "Tax", "Round off", "Total", "Paid by", "Staff"],
        ...orders.map((o) => {
          const t = totalsOf(o);
          return [
            o.billNumber, o.businessDate, o.settledAt?.toLocaleTimeString("en-IN", { timeZone: settings.timezone, hour: "2-digit", minute: "2-digit" }),
            o.number, label(o.type), label(o.source), o.sourceRef, o.table?.name, o.customerName, o.customerPhone, t.itemCount, t.itemsTotal, t.discount,
            t.serviceCharge, t.chargesTotal, t.taxable, t.tax, t.roundOff, t.total,
            o.payments.map((p) => `${label(p.method)} ${p.amount}`).join(" + "), o.createdByName,
          ];
        }),
      ]);
    }

    const report = await salesReport(range);
    if (type === "items") {
      return csvResponse(`item_sales_${suffix}`, [
        ["Item", "Category", "Quantity", "Amount (menu price)"],
        ...report.topItems.map((i) => [i.name, i.category, i.quantity, i.amount]),
      ]);
    }
    if (type === "daily") {
      return csvResponse(`daily_sales_${suffix}`, [["Date", "Bills", "Sales"], ...report.daily.map((d) => [d.date, d.bills, d.sales])]);
    }
    if (type === "tax") {
      const gst = settings.taxMode === "gst";
      return csvResponse(`tax_summary_${suffix}`, [
        gst ? ["Rate %", "Taxable value", "CGST", "SGST", "Total tax"] : ["Rate %", "Taxable value", "Tax"],
        ...report.taxes.map((t) => (gst ? [t.rate, t.taxable, Math.round((t.tax / 2) * 100) / 100, Math.round((t.tax / 2) * 100) / 100, t.tax] : [t.rate, t.taxable, t.tax])),
      ]);
    }
    fail("Unknown report type");
  });
}
