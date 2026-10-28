// Special prices, shared by the server and the order screen: an area (AC hall), an order type,
// an app (Zomato / Swiggy) or a time of day (happy hours) can change what a dish costs.
import { z } from "zod";
import { parseList, priceFor } from "./menu";

export interface PriceListData {
  id: string;
  name: string;
  active: boolean;
  adjustPercent: number;
  roundTo: number;
  areas: string;
  orderTypes: string;
  sources: string;
  days: string;
  startTime: string | null;
  endTime: string | null;
  categoryIds: string;
  overrides: string;
  sortOrder: number;
}

/** Where and when an order is taken. */
export interface PriceContext {
  area?: string | null;
  type: string;
  source: string;
  at?: Date;
  timezone: string;
}

export interface PriceOverride {
  price?: number;
  variants?: Record<string, number>;
}

const overrideSchema = z.object({
  price: z.number().min(0).optional(),
  variants: z.record(z.string(), z.number().min(0)).optional(),
});

export function parseOverrides(json: string | null | undefined): Record<string, PriceOverride> {
  try {
    const parsed = JSON.parse(json || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, o]) => (overrideSchema.safeParse(o).success ? [[id, o as PriceOverride]] : [])));
  } catch {
    return {};
  }
}

/** Day of the week (0 = Sunday) and "HH:MM" in the restaurant's time zone. */
export function localClock(at: Date, timeZone: string): { day: number; time: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, time: `${get("hour").replace("24", "00")}:${get("minute")}` };
  } catch {
    return { day: at.getDay(), time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` };
  }
}

/** True when "HH:MM" is in [start, end). Works across midnight (22:00–02:00). */
export function inTimeWindow(time: string, start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return true;
  return start <= end ? time >= start && time < end : time >= start || time < end;
}

/** Days of the week stored as JSON numbers (0 = Sunday … 6). */
export function parseDays(json: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  } catch {
    return [];
  }
}

/** Shared by price lists and offers: days of the week and a time window. */
export function onSchedule(rule: { days: string; startTime: string | null; endTime: string | null }, at: Date, timeZone: string) {
  const { day, time } = localClock(at, timeZone);
  const days = parseDays(rule.days);
  if (days.length && !days.includes(day)) return false;
  return inTimeWindow(time, rule.startTime, rule.endTime);
}

export function listApplies(list: PriceListData, ctx: PriceContext) {
  if (!list.active) return false;
  const areas = parseList(list.areas).map((a) => a.toLowerCase());
  if (areas.length && (ctx.type !== "dine_in" || !ctx.area || !areas.includes(ctx.area.toLowerCase()))) return false;
  const types = parseList(list.orderTypes);
  if (types.length && !types.includes(ctx.type)) return false;
  const sources = parseList(list.sources);
  if (sources.length && !sources.includes(ctx.source)) return false;
  return onSchedule(list, ctx.at ?? new Date(), ctx.timezone);
}

/** The price lists in force for this order right now, first match first. */
export function activeLists<T extends PriceListData>(lists: T[], ctx: PriceContext): T[] {
  return lists.filter((l) => listApplies(l, ctx)).sort((a, b) => a.sortOrder - b.sortOrder);
}

type PricedItem = { id: string; categoryId: string; price: number; variants: string };

/** The price a list gives a dish (or one portion), or null when the list leaves it alone. */
export function priceInList(list: PriceListData, item: PricedItem, variant?: string | null): number | null {
  const own = parseOverrides(list.overrides)[item.id];
  const fixed = variant ? own?.variants?.[variant] : own?.price;
  if (fixed !== undefined) return fixed;
  const categories = parseList(list.categoryIds);
  if (categories.length && !categories.includes(item.categoryId)) return null;
  if (!list.adjustPercent) return null;
  const base = priceFor(item, variant);
  if (base === null) return null;
  const step = list.roundTo > 0 ? list.roundTo : 1;
  return Math.max(0, Math.round((base * (1 + list.adjustPercent / 100)) / step) * step);
}

/** What a dish costs under the lists in force: the first list that changes it wins. */
export function menuPrice(item: PricedItem, variant: string | null | undefined, lists: PriceListData[]): { price: number | null; list: string | null } {
  const base = priceFor(item, variant);
  if (base === null) return { price: null, list: null };
  for (const l of lists) {
    const p = priceInList(l, item, variant);
    if (p !== null && p !== base) return { price: Math.round(p * 100) / 100, list: l.name };
  }
  return { price: base, list: null };
}
