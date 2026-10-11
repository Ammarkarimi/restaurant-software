// Menu helpers shared by the server and the browser.
import { z } from "zod";

export interface Variant {
  name: string;
  price: number;
}

export const variantSchema = z.object({
  name: z.string().trim().min(1, "Portion name is required").max(40),
  price: z.coerce.number().min(0, "Price cannot be negative").max(10_000_000),
});

export function parseVariants(json: string | null | undefined): Variant[] {
  try {
    const parsed = JSON.parse(json || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => {
      const r = variantSchema.safeParse(v);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

/** The price a guest pays for an item, or for one of its portions. */
export function priceFor(item: { price: number; variants: string }, variantName?: string | null): number | null {
  const variants = parseVariants(item.variants);
  if (variants.length === 0) return variantName ? null : item.price;
  const v = variants.find((x) => x.name === variantName);
  return v ? v.price : null;
}

/** Lowest price, for "from ₹180" on the menu card. */
export function fromPrice(item: { price: number; variants: string }): number {
  const variants = parseVariants(item.variants);
  return variants.length ? Math.min(...variants.map((v) => v.price)) : item.price;
}

export interface QuickAddRow {
  name: string;
  price: number;
  category: string;
  foodType: "veg" | "non_veg" | "egg";
  shortCode?: string;
}

const FOOD_WORDS: Record<string, QuickAddRow["foodType"]> = {
  veg: "veg",
  v: "veg",
  "non-veg": "non_veg",
  nonveg: "non_veg",
  non_veg: "non_veg",
  nv: "non_veg",
  egg: "egg",
  e: "egg",
};

/**
 * Reads pasted lines like "Paneer Tikka, 280, Starters, veg, PT".
 * Columns: name, price, category (optional), veg / non-veg / egg (optional), short code (optional).
 * Also accepts tab-separated text copied from Excel.
 */
export function parseQuickAdd(text: string, defaultCategory: string): { rows: QuickAddRow[]; errors: string[] } {
  const rows: QuickAddRow[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const cols = line.split(line.includes("\t") ? "\t" : ",").map((c) => c.trim());
    const [name, priceText, category, food, shortCode] = cols;
    const price = Number((priceText || "").replace(/[^\d.]/g, ""));
    if (!name || !priceText || !Number.isFinite(price)) {
      errors.push(`Line ${i + 1}: "${line}" needs a name and a price, like "Masala Dosa, 120"`);
      return;
    }
    rows.push({
      name: name.slice(0, 120),
      price,
      category: (category || defaultCategory).slice(0, 60),
      foodType: FOOD_WORDS[(food || "").toLowerCase()] ?? "veg",
      shortCode: shortCode ? shortCode.slice(0, 12).toUpperCase() : undefined,
    });
  });
  return { rows, errors };
}
