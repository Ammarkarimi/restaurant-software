import { z } from "zod";
import { round2 } from "./billing";
import { round3 } from "./stock";

export interface PurchaseLine {
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
}

export const purchaseLineSchema = z.object({
  stockItemId: z.string().min(1).max(40),
  quantity: z.coerce.number().positive("Enter how much").max(10_000_000),
  rate: z.coerce.number().min(0).max(10_000_000).default(0),
});

export function parsePurchaseLines(json: string | null | undefined): PurchaseLine[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? (parsed as PurchaseLine[]).filter((l) => l && typeof l.stockItemId === "string") : [];
  } catch {
    return [];
  }
}

export function linesTotal(lines: Array<{ quantity: number; rate: number }>) {
  return round2(lines.reduce((s, l) => s + round3(l.quantity) * l.rate, 0));
}

/** The purchase order as a WhatsApp message to the supplier. */
export function purchaseMessage(p: { number: number; lines: PurchaseLine[]; notes: string | null }, restaurantName: string) {
  return [
    `Purchase order #${p.number} from ${restaurantName}`,
    ...p.lines.map((l) => `• ${l.name}: ${round3(l.quantity)} ${l.unit}`),
    p.notes ? `Note: ${p.notes}` : null,
    "Please confirm. Thank you!",
  ]
    .filter(Boolean)
    .join("\n");
}

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier's name").max(80),
  phone: z.string().trim().max(20).nullable().optional(),
  gstin: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});
