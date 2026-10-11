// Hotel stays are counted in calendar nights, so booking dates are handled as
// "date keys" (YYYY-MM-DD) and stored as midnight UTC. This keeps the night
// count identical no matter which timezone the server or browser runs in.

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** Accepts "YYYY-MM-DD", an ISO string or a Date and returns its date key. */
export function toDateKey(value: Date | string): string {
  if (typeof value === "string" && DATE_KEY_RE.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

export function dateFromKey(key: string): Date {
  return new Date(`${toDateKey(key)}T00:00:00.000Z`);
}

export function addDays(key: string, days: number): string {
  return toDateKey(new Date(dateFromKey(key).getTime() + days * DAY_MS));
}

export function diffDays(fromKey: string, toKey: string): number {
  return Math.round((dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) / DAY_MS);
}

/** Number of nights charged for a stay. Same-day stays count as one night. */
export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  return Math.max(1, diffDays(toDateKey(checkIn), toDateKey(checkOut)));
}

/** Each night of a stay, as the date key of the evening the guest sleeps there. */
export function eachNight(checkIn: Date | string, checkOut: Date | string): string[] {
  const start = toDateKey(checkIn);
  const count = nightsBetween(checkIn, checkOut);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Friday and Saturday nights are treated as the weekend. */
export function isWeekendNight(key: string): boolean {
  const day = dateFromKey(key).getUTCDay();
  return day === 5 || day === 6;
}

/** Today's date in the hotel's timezone (servers usually run in UTC). */
export function todayKey(timeZone = "Asia/Kolkata", now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return toDateKey(now);
  }
}

/** Stays overlap when one starts before the other ends (checkout day is free). */
export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

export function formatDateKey(key: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(dateFromKey(toDateKey(key)));
}
