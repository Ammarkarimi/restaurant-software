import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { runForRestaurant } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseBillTemplate } from "@/lib/bill-template";
import { isDateKey, formatDateKey } from "@/lib/dates";
import { daySummary } from "@/lib/cash";
import { formatAmount, label } from "@/lib/utils";
import { pageCss } from "@/components/bill-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Day summary" };

type Props = { params: Promise<{ date: string }>; searchParams: Promise<{ auto?: string }> };

/** End-of-day summary (Z report) for the thermal printer. */
export default async function PrintDayPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role !== "admin") notFound();
  const { date } = await params;
  const { auto } = await searchParams;
  if (!isDateKey(date)) notFound();

  const { settings, s } = await runForRestaurant(session.restaurantId, async () => ({ settings: await getSettings(), s: await daySummary(date) }));
  const paper = parseBillTemplate(settings.billTemplate).paperSize === "58mm" ? "58mm" : "80mm";
  const Line = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
  const rule = <div className="my-1 border-t border-dashed border-black" />;
  const expected = s.close ? s.close.openingCash + s.cashSales + s.cashReceived - s.cashExpenses : s.expectedCash;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{pageCss(paper)}</style>
      <PrintButton auto={auto === "1"} title={`Day summary · ${formatDateKey(date)}`} />
      <div className="py-6 print:py-0">
        <div className="print-sheet mx-auto bg-white font-mono text-black shadow print:shadow-none" style={{ width: paper, padding: paper === "58mm" ? "2mm" : "3mm", fontSize: "12.5px", lineHeight: 1.4 }}>
          <p className="text-center font-bold">{settings.restaurantName}</p>
          <p className="text-center font-bold">DAY SUMMARY</p>
          <p className="text-center">{formatDateKey(date, { weekday: "short" })}</p>
          {rule}
          <Line l="Bills" v={String(s.bills)} />
          {s.guests > 0 && <Line l="Guests" v={String(s.guests)} />}
          <Line l="Discounts" v={formatAmount(s.discount)} />
          {s.complimentary.count > 0 && <Line l={`Complimentary (${s.complimentary.count})`} v={formatAmount(s.complimentary.value)} />}
          <Line l="Tax" v={formatAmount(s.tax)} />
          {s.cancelled > 0 && <Line l="Cancelled orders" v={String(s.cancelled)} />}
          <Line l="TOTAL SALES" v={formatAmount(s.sales)} bold />
          {rule}
          <p className="font-bold">Payments</p>
          {s.payments.map((p) => (
            <Line key={p.method} l={`${label(p.method)} (${p.count})`} v={formatAmount(p.amount)} />
          ))}
          {s.received.length > 0 && (
            <>
              {rule}
              <p className="font-bold">Received on customer accounts</p>
              {s.received.map((r) => (
                <Line key={r.method} l={`${label(r.method)} (${r.count})`} v={formatAmount(r.amount)} />
              ))}
            </>
          )}
          {rule}
          <p className="font-bold">Expenses</p>
          {s.expensesByCategory.length === 0 && <p>None</p>}
          {s.expensesByCategory.map((e) => (
            <Line key={e.category} l={e.category} v={formatAmount(e.amount)} />
          ))}
          <Line l="Total expenses" v={formatAmount(s.expensesTotal)} bold />
          {rule}
          <p className="font-bold">Cash drawer</p>
          <Line l="Opening cash" v={formatAmount(s.close?.openingCash ?? s.openingCash)} />
          <Line l="+ Cash sales" v={formatAmount(s.cashSales)} />
          {s.cashReceived > 0 && <Line l="+ Received on accounts" v={formatAmount(s.cashReceived)} />}
          <Line l="- Cash expenses" v={formatAmount(s.cashExpenses)} />
          <Line l="Expected" v={formatAmount(expected)} bold />
          {s.close ? (
            <>
              <Line l="Counted" v={formatAmount(s.close.countedCash)} />
              <Line l={s.close.difference < 0 ? "SHORT" : s.close.difference > 0 ? "EXTRA" : "Difference"} v={formatAmount(Math.abs(s.close.difference))} bold />
              <Line l="Left for tomorrow" v={formatAmount(s.close.cashLeft)} />
              {rule}
              <p>Closed by {s.close.closedByName}</p>
              <p>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: settings.timezone }).format(s.close.closedAt)}</p>
              {s.close.notes && <p>Note: {s.close.notes}</p>}
            </>
          ) : (
            <p className="mt-1 text-center">(Day not closed yet)</p>
          )}
        </div>
      </div>
    </div>
  );
}
