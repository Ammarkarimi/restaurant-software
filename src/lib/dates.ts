// Calendar dates are handled as "date keys" (YYYY-MM-DD) and stored as midnight UTC.
// This keeps business days identical no matter which timezone the server or browser runs in.

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

/** Today's date in the restaurant's timezone (servers usually run in UTC). */
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

export function formatDateKey(key: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(dateFromKey(toDateKey(key)));
}
