// The owner's daily report: sales, top dishes, cash vs UPI, cancellations, discounts, cash count,
// stock running low and today's alerts. Sent on WhatsApp / email when the day is closed, or early
// next morning by the daily job if nobody closed the day.
import { prisma, rawPrisma, runForRestaurant } from "./db";
import { getSettings } from "./settings";
import { salesReport } from "./reports";
import { daySummary } from "./cash";
import { isLow } from "./stock";
import { addDays, formatDateKey, todayKey } from "./dates";
import { deliver, waLink } from "./notify";
import { escapeHtml } from "./mail";
import { formatCurrency, label } from "./utils";

export async function buildDailyReport(date: string) {
  const settings = await getSettings();
  const c = (n: number) => formatCurrency(n, settings.currency);
  const [r, day, stock, alerts, running] = await Promise.all([
    salesReport({ from: date, to: date, timezone: settings.timezone }),
    daySummary(date),
    prisma.stockItem.findMany({ where: { active: true, lowAt: { not: null } }, select: { name: true, unit: true, quantity: true, lowAt: true } }),
    prisma.alert.findMany({ where: { createdAt: { gte: new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 3600_000), lt: new Date(Date.parse(`${addDays(date, 1)}T06:00:00Z`)) } }, select: { title: true, amount: true } }),
    prisma.order.count({ where: { status: { in: ["open", "billed"] } } }),
  ]);
  const low = stock.filter(isLow);
  const t = r.totals;
  const top = r.topItems.slice(0, 5);
  const close = day.close;

  const lines: string[] = [];
  lines.push(`📊 ${settings.restaurantName} — ${formatDateKey(date, { weekday: "short" })}`);
  lines.push("");
  lines.push(`Sales: ${c(t.sales)} from ${t.bills} bill${t.bills === 1 ? "" : "s"}${t.bills ? ` (average ${c(t.averageBill)})` : ""}`);
  if (r.payments.length) lines.push(`Payments: ${r.payments.map((p) => `${label(p.method)} ${c(p.amount)}`).join(", ")}`);
  if (r.bySource.length > 1) lines.push(`Orders from: ${r.bySource.map((s) => `${label(s.source)} ${c(s.sales)}`).join(", ")}`);
  if (top.length) lines.push(`Top dishes: ${top.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`);
  const leaks: string[] = [];
  if (r.discounts.list.length) leaks.push(`discounts ${c(t.discount - t.pointsDiscount)}`);
  if (r.complimentary.count > 0) leaks.push(`${r.complimentary.count} complimentary (${c(r.complimentary.value)})`);
  if (r.cancelled.count) leaks.push(`${r.cancelled.count} cancelled (${c(r.cancelled.value)})`);
  if (r.removedItems.count) leaks.push(`${r.removedItems.count} dish${r.removedItems.count === 1 ? "" : "es"} removed after KOT (${c(r.removedItems.value)})`);
  lines.push(leaks.length ? `Watch: ${leaks.join(", ")}` : "Watch: no discounts, cancellations or removed dishes");
  if (r.expenses.total) lines.push(`Expenses: ${c(r.expenses.total)}`);
  if (close) lines.push(`Cash count: ${close.difference === 0 ? "matches" : close.difference < 0 ? `SHORT ${c(-close.difference)}` : `extra ${c(close.difference)}`} (counted ${c(close.countedCash)}, closed by ${close.closedByName})`);
  else lines.push(`Cash: ${c(day.cashSales)} cash sales; the day was not closed${running ? `, ${running} order${running === 1 ? "" : "s"} still running` : ""}`);
  if (alerts.length) lines.push(`Alerts: ${alerts.length} (${[...new Set(alerts.map((a) => a.title))].slice(0, 3).join(", ")})`);
  if (low.length) lines.push(`Low stock: ${low.slice(0, 6).map((s) => `${s.name} ${s.quantity} ${s.unit}`).join(", ")}${low.length > 6 ? ` +${low.length - 6} more` : ""}`);
  if (r.rating.average) lines.push(`Guest rating: ${r.rating.average.toFixed(1)}★ from ${r.rating.count}`);
  const text = lines.join("\n");

  // One line per value for the WhatsApp template "Daily report for {{1}}, {{2}}: {{3}}".
  const summary = lines.slice(2).join(" · ");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;max-width:560px">
<h2 style="margin:0 0 4px;color:#ea580c">${escapeHtml(settings.restaurantName)}</h2>
<p style="margin:0 0 14px;color:#475569">Daily report · ${escapeHtml(formatDateKey(date, { weekday: "long" }))}</p>
<p style="font-size:26px;font-weight:700;margin:0 0 4px">${escapeHtml(c(t.sales))}</p>
<p style="margin:0 0 14px;color:#475569">${t.bills} bills${t.bills ? ` · average ${escapeHtml(c(t.averageBill))}` : ""}</p>
<table cellpadding="5" style="border-collapse:collapse">${lines
    .slice(3)
    .map((l) => {
      const [k, ...v] = l.split(": ");
      return `<tr><td style="color:#64748b;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td><b>${escapeHtml(v.join(": "))}</b></td></tr>`;
    })
    .join("")}</table></div>`;
  return { date, text, summary, html, sales: t.sales, shareLink: waLink(settings.alertPhone, text) };
}

/** Sends the report once per business day. Returns where it went (null = nothing set up / already sent). */
export async function sendDailyReport(date: string, opts: { force?: boolean } = {}) {
  try {
    const settings = await getSettings();
    if (!settings.dailyReportEnabled && !opts.force) return null;
    if (!settings.alertPhone && !settings.alertEmail) return null;
    if (settings.dailyReportSentFor && settings.dailyReportSentFor >= date && !opts.force) return null;
    const report = await buildDailyReport(date);
    const sentVia = await deliver({
      phone: settings.alertPhone,
      email: settings.alertEmail,
      kind: "report",
      params: [settings.restaurantName, formatDateKey(date), report.summary],
      subject: `${settings.restaurantName}: ${formatCurrency(report.sales, settings.currency)} sales on ${formatDateKey(date)}`,
      text: report.text,
      html: report.html,
    });
    if (sentVia) await prisma.restaurantSettings.update({ where: { restaurantId: settings.restaurantId }, data: { dailyReportSentFor: date } });
    return sentVia;
  } catch (error) {
    console.error("Daily report failed", error);
    return null;
  }
}

/**
 * The daily job (early morning): for every active restaurant that wants the report and did not
 * get one for yesterday (nobody closed the day), send yesterday's report now.
 */
export async function sendMissedReports(now = new Date()) {
  const rows = await rawPrisma.restaurantSettings.findMany({
    where: { dailyReportEnabled: true, OR: [{ alertPhone: { not: null } }, { alertEmail: { not: null } }], restaurant: { status: "active" } },
    select: { restaurantId: true, timezone: true, dailyReportSentFor: true },
  });
  const results: Array<{ restaurantId: string; date: string; sentVia: string | null }> = [];
  for (const row of rows) {
    const yesterday = addDays(todayKey(row.timezone, now), -1);
    if (row.dailyReportSentFor && row.dailyReportSentFor >= yesterday) continue;
    const sentVia = await runForRestaurant(row.restaurantId, () => sendDailyReport(yesterday));
    results.push({ restaurantId: row.restaurantId, date: yesterday, sentVia });
  }
  return results;
}
