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

// ---------- Reading a supplier's bill ----------

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["fresh", "best", "quality", "pure", "loose", "pkt", "pack", "kg", "gm", "ltr", "pcs", "nos"].includes(w));

/**
 * The stock item a line on a supplier's bill most likely is ("Amul Paneer 1kg" → Paneer), or null
 * when nothing is close enough. Exact names win, then a name inside the other, then shared words.
 */
export function matchStockItem<T extends { id: string; name: string }>(billName: string, items: T[]): T | null {
  const b = words(billName);
  if (!b.length) return null;
  const joined = b.join(" ");
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const w = words(item.name);
    if (!w.length) continue;
    const name = w.join(" ");
    let score = 0;
    if (name === joined) score = 1;
    else if (` ${joined} `.includes(` ${name} `)) score = 0.9;
    else if (` ${name} `.includes(` ${joined} `)) score = 0.8;
    else {
      const shared = w.filter((x) => b.includes(x) || b.some((y) => (y.length > 3 && x.startsWith(y)) || (x.length > 3 && y.startsWith(x)))).length;
      score = shared / Math.max(w.length, Math.min(b.length, 3));
      if (score < 0.5) score = 0;
      else score *= 0.7;
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && item.name.length > best.item.name.length))) best = { item, score };
  }
  return best?.item ?? null;
}

const UNIT_ALIASES: Record<string, string> = { kgs: "kg", kilo: "kg", gm: "g", gms: "g", gram: "g", grams: "g", ltr: "L", litre: "L", liter: "L", l: "L", lt: "L", ml: "ml", pc: "pcs", pcs: "pcs", nos: "pcs", no: "pcs", piece: "pcs", pieces: "pcs", dozen: "dozen", dz: "dozen", pkt: "pack", packet: "pack", box: "box", btl: "bottle", bottle: "bottle" };
const FACTOR: Record<string, [string, number]> = { g: ["kg", 0.001], ml: ["L", 0.001], dozen: ["pcs", 12] };

/** Converts a bill's quantity to the stock item's unit where that is plain (g → kg, ml → L, dozen → pcs). */
export function convertQuantity(quantity: number, billUnit: string, stockUnit: string): { quantity: number; converted: boolean } {
  const from = UNIT_ALIASES[billUnit.trim().toLowerCase()] ?? billUnit.trim();
  const to = stockUnit;
  if (!from || from.toLowerCase() === to.toLowerCase()) return { quantity, converted: false };
  if (FACTOR[from]?.[0] === to) return { quantity: round3(quantity * FACTOR[from][1]), converted: true };
  if (FACTOR[to]?.[0] === from) return { quantity: round3(quantity / FACTOR[to][1]), converted: true };
  return { quantity, converted: false };
}
