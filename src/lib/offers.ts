// Saved offers and coupon codes, shared by the server and the order screen.
import { z } from "zod";
import { parseList } from "./menu";
import { onSchedule, parseDays } from "./pricing";
import { formatCurrency, formatDate, label, ORDER_TYPES } from "./utils";

export interface OfferData {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
  maxDiscount: number | null;
  minBill: number;
  orderTypes: string;
  days: string;
  startTime: string | null;
  endTime: string | null;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  timesUsed: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "10% off, up to ₹100" or "₹50 off". */
export function offerValue(o: Pick<OfferData, "type" | "value" | "maxDiscount">) {
  if (o.type === "amount") return `${formatCurrency(o.value)} off`;
  return `${o.value}% off${o.maxDiscount ? `, up to ${formatCurrency(o.maxDiscount)}` : ""}`;
}

/** "Mon–Fri · 12:00–15:00 · dine-in · bills above ₹1,000 · till 31 Dec" */
export function offerRules(o: OfferData) {
  const parts: string[] = [];
  const days = parseDays(o.days);
  if (days.length && days.length < 7) parts.push(days.map((d) => DAY_NAMES[d]).join(", "));
  if (o.startTime) parts.push(`${o.startTime}–${o.endTime}`);
  const types = parseList(o.orderTypes);
  if (types.length) parts.push(types.map(label).join(" / "));
  if (o.minBill > 0) parts.push(`bills of ${formatCurrency(o.minBill)} or more`);
  if (o.validFrom) parts.push(`from ${formatDate(o.validFrom)}`);
  if (o.validTo) parts.push(`till ${formatDate(o.validTo)}`);
  return parts.join(" · ");
}

/** Why an offer cannot be used on this order right now, or null when it can. */
export function offerProblem(o: OfferData, ctx: { itemsTotal: number; type: string; at?: Date; timezone: string; today: string }): string | null {
  if (!o.active) return "This offer is switched off";
  if (o.validFrom && ctx.today < o.validFrom) return `This offer starts on ${formatDate(o.validFrom)}`;
  if (o.validTo && ctx.today > o.validTo) return `This offer ended on ${formatDate(o.validTo)}`;
  const types = parseList(o.orderTypes);
  if (types.length && !types.includes(ctx.type)) return `Only for ${types.map(label).join(" / ")} orders`;
  if (!onSchedule(o, ctx.at ?? new Date(), ctx.timezone)) {
    const days = parseDays(o.days);
    const when = [days.length && days.length < 7 ? days.map((d) => DAY_NAMES[d]).join(", ") : null, o.startTime ? `${o.startTime}–${o.endTime}` : null].filter(Boolean).join(" ");
    return `Only ${when}`;
  }
  if (ctx.itemsTotal < o.minBill) return `Needs a bill of ${formatCurrency(o.minBill)} (now ${formatCurrency(ctx.itemsTotal)})`;
  return null;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 17:30");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** An offer typed by the owner. */
export const offerSchema = z
  .object({
    name: z.string().trim().min(1, "Give the offer a name").max(60),
    code: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9_-]*$/, "Use letters and numbers only in the code")
      .transform((c) => c.toUpperCase() || null)
      .nullable()
      .default(null),
    type: z.enum(["percent", "amount"]),
    value: z.coerce.number().positive("Enter the discount").max(10_000_000),
    maxDiscount: z.coerce.number().positive().max(10_000_000).nullable().default(null),
    minBill: z.coerce.number().min(0).max(10_000_000).default(0),
    orderTypes: z.array(z.enum(ORDER_TYPES)).max(3).default([]),
    days: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
    startTime: time.nullable().default(null),
    endTime: time.nullable().default(null),
    validFrom: date.nullable().default(null),
    validTo: date.nullable().default(null),
    active: z.boolean().default(true),
  })
  .superRefine((o, ctx) => {
    if (o.type === "percent" && o.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "A discount cannot be more than 100%" });
    if (!!o.startTime !== !!o.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Give both a start and an end time, or neither" });
    if (o.validFrom && o.validTo && o.validTo < o.validFrom) ctx.addIssue({ code: "custom", path: ["validTo"], message: "The end date is before the start date" });
  });

export function offerData(o: z.infer<typeof offerSchema>) {
  return {
    ...o,
    maxDiscount: o.type === "percent" ? o.maxDiscount : null,
    orderTypes: JSON.stringify(o.orderTypes),
    days: JSON.stringify([...new Set(o.days)].sort()),
  };
}
