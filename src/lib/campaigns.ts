import type { Prisma } from "@prisma/client";
import type { Db } from "./db";
import { addDays } from "./dates";
import { formatCurrency } from "./utils";

export const SEGMENTS = [
  { id: "all", label: "Everyone with a phone number" },
  { id: "birthday", label: "Birthdays in the next 7 days" },
  { id: "inactive", label: "Not seen for 30 days or more" },
  { id: "new", label: "First visit in the last 30 days" },
  { id: "regulars", label: "Regulars (5 or more visits)" },
  { id: "top", label: "Top 50 by money spent" },
  { id: "owes", label: "Owe money (pay later)" },
] as const;

export type SegmentId = (typeof SEGMENTS)[number]["id"];

export interface Recipient {
  customerId: string;
  name: string | null;
  phone: string;
  points: number;
  balance: number;
  sentAt: string | null;
}

/** Customers in a group, today. Birthdays compare month and day only. */
export async function segmentCustomers(db: Db, segment: SegmentId, today: string): Promise<Recipient[]> {
  const now = new Date();
  const days30 = new Date(now.getTime() - 30 * 24 * 3600_000);
  const where: Prisma.CustomerWhereInput =
    segment === "inactive"
      ? { lastVisitAt: { lt: days30 } }
      : segment === "new"
        ? { createdAt: { gte: days30 } }
        : segment === "regulars"
          ? { visits: { gte: 5 } }
          : segment === "owes"
            ? { balance: { lt: 0 } }
            : segment === "birthday"
              ? { birthday: { not: null } }
              : {};
  let customers = await db.customer.findMany({
    where,
    orderBy: segment === "top" ? { totalSpent: "desc" } : { lastVisitAt: { sort: "desc", nulls: "last" } },
    take: segment === "top" ? 50 : 2000,
    select: { id: true, name: true, phone: true, points: true, balance: true, birthday: true },
  });
  if (segment === "birthday") {
    const coming = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, i).slice(5)));
    customers = customers.filter((c) => c.birthday && coming.has(c.birthday.slice(5)));
  }
  return customers.map((c) => ({ customerId: c.id, name: c.name, phone: c.phone, points: c.points, balance: c.balance, sentAt: null }));
}

/** Fills in {name}, {points} and {due} for one customer. */
export function personalise(message: string, r: Pick<Recipient, "name" | "points" | "balance">, currency = "INR") {
  const first = r.name?.trim().split(/\s+/)[0];
  return message
    .replace(/\{name\}/gi, first || "there")
    .replace(/\{points\}/gi, String(Math.floor(r.points)))
    .replace(/\{due\}/gi, formatCurrency(Math.max(0, -r.balance), currency));
}

export function parseRecipients(json: string | null | undefined): Recipient[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
