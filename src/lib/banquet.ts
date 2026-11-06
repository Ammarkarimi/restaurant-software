// Banquets and functions: halls, per-plate packages, bookings from enquiry to invoice, and payments.
// Shared by the server and the screens, so totals always match.
import { z } from "zod";

export const BANQUET_STATUSES = ["enquiry", "tentative", "confirmed", "completed", "cancelled"] as const;
export type BanquetStatus = (typeof BANQUET_STATUSES)[number];

export const STATUS_LABEL: Record<BanquetStatus, string> = {
  enquiry: "Enquiry",
  tentative: "Tentative (hold)",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const EVENT_TYPES = ["Birthday", "Wedding", "Engagement", "Reception", "Anniversary", "Corporate", "Kitty party", "Get-together", "Religious function", "Other"];
export const BANQUET_PAYMENT_METHODS = ["cash", "upi", "card", "bank", "cheque"] as const;

/** Bookings that hold the hall: a tentative hold or a confirmed booking. */
export const HOLDS_HALL: BanquetStatus[] = ["tentative", "confirmed"];

export interface Extra {
  name: string;
  amount: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function parseJsonArray<T>(json: string | null | undefined, ok: (x: unknown) => x is T): T[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter(ok) : [];
  } catch {
    return [];
  }
}

export const parseExtras = (json: string | null | undefined) =>
  parseJsonArray<Extra>(json, (x): x is Extra => !!x && typeof (x as Extra).name === "string" && typeof (x as Extra).amount === "number");
export const parseMenu = (json: string | null | undefined) => parseJsonArray<string>(json, (x): x is string => typeof x === "string");

export interface BanquetMoneyInput {
  guests: number;
  guaranteedGuests: number;
  finalGuests: number | null;
  pricePerPlate: number;
  hallRent: number;
  extras: Extra[];
  discount: number;
  foodTaxRate: number;
  otherTaxRate: number;
  taxMode: string;
}

export interface BanquetTotals {
  /** Plates charged: the count on the day (or expected), never below the guaranteed number. */
  plates: number;
  food: number;
  hallRent: number;
  extras: number;
  subtotal: number;
  discount: number;
  taxable: number;
  taxLines: Array<{ rate: number; taxable: number; tax: number }>;
  tax: number;
  roundOff: number;
  total: number;
}

/**
 * The bill for a function. Food is taxed at the food rate (5% for restaurants in India); hall rent
 * and extras (decoration, DJ…) at the other rate (18%). A discount is shared between them in
 * proportion. The total is rounded to the rupee.
 */
export function banquetTotals(e: BanquetMoneyInput): BanquetTotals {
  const plates = Math.max(e.finalGuests ?? e.guests, e.guaranteedGuests, 0);
  const food = r2(plates * e.pricePerPlate);
  const extras = r2(e.extras.reduce((s, x) => s + x.amount, 0));
  const other = r2(e.hallRent + extras);
  const subtotal = r2(food + other);
  const discount = r2(Math.min(Math.max(e.discount, 0), subtotal));
  const foodShare = subtotal ? discount * (food / subtotal) : 0;
  const foodTaxable = r2(food - foodShare);
  const otherTaxable = r2(other - (discount - foodShare));
  const taxed = e.taxMode !== "none";
  const byRate = new Map<number, { taxable: number; tax: number }>();
  const add = (rate: number, taxable: number) => {
    if (taxable <= 0) return;
    const x = byRate.get(rate) ?? { taxable: 0, tax: 0 };
    x.taxable += taxable;
    x.tax += taxed ? (taxable * rate) / 100 : 0;
    byRate.set(rate, x);
  };
  add(taxed ? e.foodTaxRate : 0, foodTaxable);
  add(taxed ? e.otherTaxRate : 0, otherTaxable);
  const taxLines = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, x]) => ({ rate, taxable: r2(x.taxable), tax: r2(x.tax) }));
  const taxable = r2(foodTaxable + otherTaxable);
  const tax = r2(taxLines.reduce((s, l) => s + l.tax, 0));
  const exact = r2(taxable + tax);
  const total = Math.round(exact);
  return { plates, food, hallRent: r2(e.hallRent), extras, subtotal, discount, taxable, taxLines, tax, roundOff: r2(total - exact), total };
}

/** "19:00" → minutes after midnight. */
function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Do two time slots on the same day overlap? An end before the start runs past midnight. */
export function slotsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const a0 = minutes(aStart);
  let a1 = minutes(aEnd);
  const b0 = minutes(bStart);
  let b1 = minutes(bEnd);
  if (a1 <= a0) a1 += 24 * 60;
  if (b1 <= b0) b1 += 24 * 60;
  return a0 < b1 && b0 < a1;
}

export interface Slot {
  id: string;
  number: number;
  hallId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
}

/** Other bookings that already hold the same hall at an overlapping time. */
export function clashes(event: Pick<Slot, "id" | "hallId" | "date" | "startTime" | "endTime">, others: Slot[]): Slot[] {
  if (!event.hallId) return [];
  return others.filter(
    (o) => o.id !== event.id && o.hallId === event.hallId && o.date === event.date && HOLDS_HALL.includes(o.status as BanquetStatus) && slotsOverlap(event.startTime, event.endTime, o.startTime, o.endTime)
  );
}

/** Which status changes are allowed from each status. */
export const NEXT_STATUS: Record<BanquetStatus, BanquetStatus[]> = {
  enquiry: ["tentative", "confirmed", "cancelled"],
  tentative: ["enquiry", "confirmed", "cancelled"],
  confirmed: ["tentative", "completed", "cancelled"],
  completed: [],
  cancelled: ["enquiry"],
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time looks like 19:30");
const money = z.coerce.number().min(0).max(100_000_000);

export const banquetEventSchema = z.object({
  customerName: z.string().trim().min(1, "Enter the customer's name").max(100),
  customerPhone: z.string().trim().min(6, "Enter the customer's phone number").max(20),
  customerEmail: z.string().trim().email("Email is not valid").or(z.literal("")).nullable().optional(),
  customerGstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN should be 15 characters, like 27ABCDE1234F1Z5")
    .nullable()
    .optional(),
  company: z.string().trim().max(120).nullable().optional(),
  eventType: z.string().trim().min(1).max(40),
  title: z.string().trim().max(120).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date"),
  startTime: time,
  endTime: time,
  hallId: z.string().nullable().optional(),
  guests: z.coerce.number().int().min(1, "Enter the number of guests").max(10_000),
  guaranteedGuests: z.coerce.number().int().min(0).max(10_000).default(0),
  finalGuests: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
  packageId: z.string().nullable().optional(),
  pricePerPlate: money,
  menu: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
  extras: z.array(z.object({ name: z.string().trim().min(1, "Each extra needs a name").max(60), amount: money })).max(30).default([]),
  hallRent: money,
  discount: money.default(0),
  foodTaxRate: z.coerce.number().min(0).max(28),
  otherTaxRate: z.coerce.number().min(0).max(28),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type BanquetEventInput = z.infer<typeof banquetEventSchema>;

export const banquetHallSchema = z.object({
  name: z.string().trim().min(1, "Enter the hall's name").max(60),
  capacity: z.coerce.number().int().min(1).max(10_000),
  rent: money,
  notes: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().default(true),
});

export const banquetPackageSchema = z.object({
  name: z.string().trim().min(1, "Enter the package name").max(60),
  foodType: z.enum(["veg", "non_veg", "both"]).default("veg"),
  pricePerPlate: money,
  menu: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
  minGuests: z.coerce.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
});

export const banquetPaymentSchema = z.object({
  amount: z.coerce.number().refine((n) => n !== 0 && Math.abs(n) <= 100_000_000, "Enter the amount"),
  method: z.enum(BANQUET_PAYMENT_METHODS),
  reference: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

/** "19:00" → "7:00 pm". */
export function timeText(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
