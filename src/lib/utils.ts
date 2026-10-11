import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let currencyCode = "INR";

/** Called once by the app shell with the restaurant's currency setting. */
export function setCurrency(code: string) {
  currencyCode = code || "INR";
}

export function formatCurrency(amount: number, currency = currencyCode): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0)}`;
  }
}

/** Always two decimals, for printed bills: "1,234.50". */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
}

export function currencySymbol(currency = currencyCode): string {
  try {
    const part = new Intl.NumberFormat("en-IN", { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatDate(date: Date | string): string {
  // Plain date keys are calendar dates; show them without timezone shifts.
  const isKey = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(isKey && { timeZone: "UTC" }),
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  }).format(new Date(date));
}

export function formatTime(date: Date | string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", ...(timeZone && { timeZone }) }).format(new Date(date));
}

/** "5 min", "1 h 20 min" since a moment. */
export function minutesSince(date: Date | string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const;
export const ORDER_STATUSES = ["open", "billed", "settled", "cancelled"] as const;
export const FOOD_TYPES = ["veg", "non_veg", "egg"] as const;
export const PAYMENT_METHODS = ["cash", "upi", "card", "other"] as const;
export const TAX_MODES = ["gst", "simple", "none"] as const;

export type OrderType = (typeof ORDER_TYPES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type FoodType = (typeof FOOD_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Plain-language labels so people who are new to restaurant software understand them.
export const LABELS: Record<string, string> = {
  // order types
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  // order status
  open: "Running",
  billed: "Bill printed",
  settled: "Paid",
  cancelled: "Cancelled",
  // table status
  free: "Free",
  running: "Running",
  // food types
  veg: "Veg",
  non_veg: "Non-veg",
  egg: "Egg",
  // payments
  cash: "Cash",
  upi: "UPI / QR",
  card: "Card",
  other: "Other",
  // tax modes
  gst: "GST (CGST + SGST)",
  simple: "One tax line (VAT / sales tax)",
  none: "No tax",
  // discounts
  percent: "%",
  amount: "Amount",
  // roles
  admin: "Owner / Manager",
  staff: "Cashier / Captain",
};

export function label(key: string | null | undefined): string {
  if (!key) return "";
  return LABELS[key] ?? titleCase(key);
}
