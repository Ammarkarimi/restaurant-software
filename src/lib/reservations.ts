import { z } from "zod";

export const RESERVATION_STATUSES = ["requested", "booked", "seated", "cancelled", "no_show"] as const;
export const RESERVATION_SOURCES = ["phone", "walk_in", "online"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const reservationSchema = z.object({
  name: z.string().trim().min(1, "Enter the guest's name").max(80),
  phone: z.string().trim().min(6, "Enter a phone number").max(20),
  guests: z.coerce.number().int().min(1, "At least 1 guest").max(200),
  date,
  time,
  tableId: z.string().max(40).nullable().optional(),
  occasion: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  source: z.enum(RESERVATION_SOURCES).default("phone"),
});

/** "7:30 pm" from "19:30". */
export function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Minutes from midnight, for comparing booking times with now. */
export function minutesOf(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
