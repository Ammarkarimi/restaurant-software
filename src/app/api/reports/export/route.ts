import { NextRequest, NextResponse } from "next/server";
import { csvResponse, fail, withAdmin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { addDays, diffDays, isDateKey, todayKey } from "@/lib/dates";
import { parseCommission, salesReport, settledOrders } from "@/lib/reports";
import { totalsOf } from "@/lib/orders";
import { label } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { buildGstr1, tallyLedgers, tallyVouchers, type AccountingBill } from "@/lib/accounting";
import type { ReportRange } from "@/lib/reports";
import { eventInclude, totalsOfEvent } from "@/lib/banquet-server";
import type { SettingsRecord } from "@/lib/settings";

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

    if (type.startsWith("gstr1-") || type.startsWith("tally")) return accountingFile(type, range, settings, sp, suffix);

    const report = await salesReport(range, { commission: parseCommission(settings.appCommission) });
    if (type === "discounts") {
      return csvResponse(`discounts_${suffix}`, [
        ["Bill #", "Discount", "Reason / offer", "Staff"],
        ...report.discounts.list.map((d) => [d.billNumber, d.amount, d.reason, d.by]),
      ]);
    }
    if (type === "removed") {
      return csvResponse(`removed_after_kitchen_${suffix}`, [
        ["Dish", "Quantity", "Value", "Reason", "Order #", "Bill #", "Table", "Order opened by"],
        ...report.removedItems.list.map((i) => [i.name, i.quantity, i.value, i.reason, i.order.number, i.order.billNumber, i.order.table?.name, i.order.createdByName]),
      ]);
    }
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

async function accountingBills(range: ReportRange, sacCode: string): Promise<AccountingBill[]> {
  const [orders, banquets] = await Promise.all([settledOrders(range), banquetInvoices(range, sacCode)]);
  return [...orders
    .filter((o) => o.billNumber && o.businessDate)
    .map((o) => {
      const t = totalsOf(o);
      return {
        billNumber: o.billNumber!,
        date: o.businessDate!,
        total: t.total,
        taxable: t.taxable,
        tax: t.tax,
        roundOff: t.roundOff,
        taxLines: t.taxLines,
        payments: o.payments.map((p) => ({ method: p.method, amount: p.amount })),
        customerGstin: o.customerGstin,
        customerName: o.customerName,
        source: o.source,
        taxMode: o.taxMode,
      };
    }), ...banquets];
}

/** Banquet invoices of the period, in the same shape: food at the food rate, hall rent / extras under SAC 997212. */
async function banquetInvoices(range: ReportRange, sacCode: string): Promise<AccountingBill[]> {
  const events = await prisma.banquetEvent.findMany({ where: { status: "completed", invoiceNumber: { not: null }, businessDate: { gte: range.from, lte: range.to } }, include: eventInclude, orderBy: { invoicedAt: "asc" } });
  return events.map((e) => {
    const t = totalsOfEvent(e);
    const paid = e.payments.reduce((s, p) => s + p.amount, 0);
    // Money not yet paid is owed by the customer (their account); bank / cheque go to the bank ledger.
    const payments = [...e.payments.map((p) => ({ method: p.method === "bank" || p.method === "cheque" ? "online" : p.method, amount: p.amount })), ...(t.total - paid > 0.005 ? [{ method: "account", amount: Math.round((t.total - paid) * 100) / 100 }] : [])];
    return {
      billNumber: e.invoiceNumber!,
      date: e.businessDate!,
      total: t.total,
      taxable: t.taxable,
      tax: t.tax,
      roundOff: t.roundOff,
      taxLines: t.taxLines.map((l) => ({ ...l, sac: l.rate === e.foodTaxRate ? sacCode : "997212" })),
      payments,
      customerGstin: e.customerGstin,
      customerName: e.company || e.customerName,
      source: "banquet",
      taxMode: e.taxMode,
    };
  });
}

/** GSTR-1 tables (CSV in the GST offline tool's layout) and Tally import files (XML). */
async function accountingFile(type: string, range: ReportRange, settings: SettingsRecord, sp: URLSearchParams, suffix: string) {
  const bills = await accountingBills(range, settings.sacCode);
  if (type.startsWith("tally")) {
    const company = (sp.get("company") || settings.legalName || settings.restaurantName).slice(0, 100);
    const gst = settings.taxMode === "gst";
    const body = type === "tally-ledgers" ? tallyLedgers(company, gst) : tallyVouchers(bills, { company, perBill: sp.get("per") === "bill", gst });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type === "tally-ledgers" ? "tally_ledgers.xml" : `tally_sales_${suffix.replace(".csv", ".xml")}`}"`,
      },
    });
  }
  const cancelled = await prisma.order.findMany({ where: { status: "cancelled", billNumber: { not: null }, businessDate: { gte: range.from, lte: range.to } }, select: { billNumber: true } });
  const g = buildGstr1(bills, {
    gstin: settings.gstin,
    sacCode: settings.sacCode,
    cancelled: cancelled.map((c) => c.billNumber!),
    allBillNumbers: [...bills.map((b) => b.billNumber), ...cancelled.map((c) => c.billNumber!)],
  });
  if (type === "gstr1-summary") return NextResponse.json({ summary: g.summary, gstin: settings.gstin, taxMode: settings.taxMode });
  const table = type.slice("gstr1-".length) as "b2b" | "b2cs" | "hsn" | "docs" | "eco";
  if (!(table in g) || table === ("summary" as string)) fail("Unknown GSTR-1 table");
  return csvResponse(`gstr1_${table}_${suffix}`, g[table]);
}
