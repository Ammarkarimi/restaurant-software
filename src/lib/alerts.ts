// Owner alerts: things that often mean money is leaking. Saved for the Alerts screen and sent on
// WhatsApp / email. Never throws, so a failed alert never stops a bill.
import { after } from "next/server";
import { currentRestaurantId, prisma, rawPrisma } from "./db";
import { getSettings } from "./settings";
import { ALERT_KINDS, parseAlertRules, type AlertRules } from "./alert-rules";
import { deliver } from "./notify";
import { formatCurrency } from "./utils";

export type AlertKind = keyof typeof ALERT_KINDS;

interface Actor {
  name: string;
  role?: string;
}

export interface AlertInput {
  kind: AlertKind;
  title: string;
  message: string;
  orderId?: string | null;
  amount?: number;
}

/** Sends one alert if its rule is on. `check` can look at the rules (e.g. the discount limit) before it is raised. */
export async function raiseAlert(user: Actor | null, input: AlertInput | ((rules: AlertRules, currency: string) => AlertInput | null), opts: { evenForManagers?: boolean } = {}) {
  try {
    const settings = await getSettings();
    const rules = parseAlertRules(settings.alertRules);
    if (user?.role === "admin" && !rules.includeManagers && !opts.evenForManagers) return;
    const a = typeof input === "function" ? input(rules, settings.currency) : input;
    if (!a || !rules[ALERT_KINDS[a.kind].rule]) return;
    const alert = await prisma.alert.create({
      data: {
        restaurantId: currentRestaurantId(),
        kind: a.kind,
        title: a.title,
        message: a.message,
        orderId: a.orderId ?? null,
        staffName: user?.name ?? null,
        amount: Math.round((a.amount ?? 0) * 100) / 100,
      },
    });
    if (!settings.alertPhone && !settings.alertEmail) return;
    const name = settings.restaurantName;
    const line = `${a.title}: ${a.message}${user ? ` (by ${user.name})` : ""}`;
    const send = async () => {
      const sentVia = await deliver({
        phone: settings.alertPhone,
        email: settings.alertEmail,
        kind: "alert",
        params: [name, line],
        subject: `⚠ ${name}: ${a.title}${a.amount ? ` · ${formatCurrency(a.amount, settings.currency)}` : ""}`,
        text: `⚠ ${name}\n${a.title}\n\n${a.message}${user ? `\nBy: ${user.name}` : ""}\nTime: ${new Date().toLocaleString("en-IN", { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" })}\n\nOpen Alerts in the app for details.`,
      });
      if (sentVia) await rawPrisma.alert.update({ where: { id: alert.id }, data: { sentVia } });
    };
    // Send after the screen has its answer, so the counter never waits for WhatsApp.
    try {
      after(send);
    } catch {
      await send();
    }
  } catch (error) {
    console.error("Failed to raise alert", error);
  }
}

/** Changes made to an order after its bill was first printed, read from the activity log. */
export async function changesAfterPrint(orderNumber: number, since: Date | null) {
  if (!since) return [];
  const rows = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: since },
      action: { in: ["Changed discount", "Applied offer", "Removed item after KOT", "Removed item", "Changed charges", "Removed service charge", "Changed service charge", "Made bill complimentary", "Loyalty points used", "Moved items", "Split bill"] },
      details: { contains: `#${orderNumber}` },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  return rows.filter((r) => new RegExp(`#${orderNumber}\\b`).test(r.details ?? "")).map((r) => `${r.action}${r.details ? ` — ${r.details.replace(/^Order #\d+:\s*/, "")}` : ""} (${r.staffName})`);
}
