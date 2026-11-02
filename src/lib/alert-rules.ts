// Which owner alerts are on, and their limits. Stored as JSON in settings.alertRules.

export interface AlertRules {
  /** A bill paid for less than it was printed for (items removed or discount given after printing). */
  billChanged: boolean;
  /** A dish taken off, or an order cancelled, after the kitchen got it; a paid bill cancelled. */
  kotCancel: boolean;
  /** A discount of at least `discountPercent` % of the bill, or a complimentary bill. */
  discount: boolean;
  discountPercent: number;
  /** Payment mode changed on a paid bill (e.g. cash → UPI). */
  paymentMode: boolean;
  /** Cash short by at least `cashShortAmount` at day close. */
  cashShort: boolean;
  cashShortAmount: number;
  /** Also alert for things the owner / manager accounts do themselves. */
  includeManagers: boolean;
}

export const DEFAULT_ALERT_RULES: AlertRules = {
  billChanged: true,
  kotCancel: true,
  discount: true,
  discountPercent: 15,
  paymentMode: true,
  cashShort: true,
  cashShortAmount: 100,
  includeManagers: false,
};

export function parseAlertRules(json: string | null | undefined): AlertRules {
  let raw: Record<string, unknown> = {};
  try {
    const o = JSON.parse(json || "{}");
    if (o && typeof o === "object" && !Array.isArray(o)) raw = o;
  } catch {
    // fall back to the defaults
  }
  const out = { ...DEFAULT_ALERT_RULES };
  for (const k of Object.keys(DEFAULT_ALERT_RULES) as Array<keyof AlertRules>) {
    const v = raw[k];
    if (typeof v === typeof DEFAULT_ALERT_RULES[k]) (out as Record<string, unknown>)[k] = v;
  }
  out.discountPercent = Math.min(100, Math.max(1, out.discountPercent));
  out.cashShortAmount = Math.max(0, out.cashShortAmount);
  return out;
}

export const ALERT_KINDS: Record<string, { label: string; rule: keyof AlertRules }> = {
  bill_changed: { label: "Bill changed after printing", rule: "billChanged" },
  kot_cancel: { label: "Removed after KOT", rule: "kotCancel" },
  order_cancel: { label: "Order cancelled", rule: "kotCancel" },
  discount: { label: "Big discount", rule: "discount" },
  complimentary: { label: "Complimentary bill", rule: "discount" },
  payment_mode: { label: "Payment mode changed", rule: "paymentMode" },
  cash_short: { label: "Cash short", rule: "cashShort" },
};
