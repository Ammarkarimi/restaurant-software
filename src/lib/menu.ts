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

// ---------- add-ons ----------

export interface AddonOption {
  name: string;
  price: number;
}

/** An add-on group as stored: "Toppings" with its options as JSON. */
export interface AddonGroupData {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: string;
}

/** An add-on chosen for one dish on an order. Its price is already part of the line's unit price. */
export interface ChosenAddon {
  group: string;
  name: string;
  price: number;
}

export const addonOptionSchema = z.object({
  name: z.string().trim().min(1, "Each option needs a name").max(60),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
});

const chosenSchema = z.object({ group: z.string(), name: z.string(), price: z.number() });

export function parseAddonOptions(json: string | null | undefined): AddonOption[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.flatMap((o) => (addonOptionSchema.safeParse(o).success ? [addonOptionSchema.parse(o)] : [])) : [];
  } catch {
    return [];
  }
}

export function parseChosenAddons(json: string | null | undefined): ChosenAddon[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.flatMap((o) => (chosenSchema.safeParse(o).success ? [o as ChosenAddon] : [])) : [];
  } catch {
    return [];
  }
}

/** A JSON list of strings, e.g. the add-on group ids of a dish. Bad JSON reads as an empty list. */
export function parseList(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addonsTotal(addons: ChosenAddon[]) {
  return addons.reduce((sum, a) => sum + a.price, 0);
}

/** "Extra cheese, Olives" for kitchen tickets and bills. */
export function addonText(addons: ChosenAddon[] | string | null | undefined) {
  const list = typeof addons === "string" || !addons ? parseChosenAddons(addons as string) : addons;
  return list.map((a) => a.name).join(", ");
}

/** The add-on groups of a dish, in the dish's order, leaving out groups with no options. */
export function groupsForItem<T extends AddonGroupData>(item: { addonGroupIds: string }, groups: T[]): T[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return parseList(item.addonGroupIds).flatMap((id) => {
    const g = byId.get(id);
    return g && parseAddonOptions(g.options).length ? [g] : [];
  });
}

/** "Choose 1", "Choose up to 3", "Choose 1 to 2" or "Optional" for an add-on group. */
export function choiceHint(g: Pick<AddonGroupData, "minSelect" | "maxSelect">) {
  const { minSelect: min, maxSelect: max } = g;
  if (min > 0 && max === min) return `Choose ${min}`;
  if (min > 0 && max > min) return `Choose ${min} to ${max}`;
  if (min > 0) return `Choose at least ${min}`;
  if (max > 0) return `Optional · up to ${max}`;
  return "Optional";
}

/**
 * Checks picks against a dish's add-on groups (minimum and maximum per group, options that exist)
 * and returns them with their prices, or the problem in plain words.
 */
export function chooseAddons(
  dishName: string,
  groups: AddonGroupData[],
  picks: Array<{ groupId: string; name: string }>
): { addons: ChosenAddon[] } | { error: string } {
  const addons: ChosenAddon[] = [];
  for (const g of groups) {
    const options = parseAddonOptions(g.options);
    const mine = picks.filter((p) => p.groupId === g.id);
    const names = [...new Set(mine.map((p) => p.name))];
    if (names.length < g.minSelect) return { error: `${dishName}: ${choiceHint(g).toLowerCase()} in “${g.name}”` };
    if (g.maxSelect > 0 && names.length > g.maxSelect) return { error: `${dishName}: choose at most ${g.maxSelect} in “${g.name}”` };
    const chosen = options.filter((o) => names.includes(o.name));
    if (chosen.length !== names.length) return { error: `${dishName}: an option in “${g.name}” is no longer available` };
    addons.push(...chosen.map((o) => ({ group: g.name, name: o.name, price: o.price })));
  }
  if (picks.some((p) => !groups.some((g) => g.id === p.groupId))) return { error: `${dishName}: an add-on is no longer offered with this dish` };
  return { addons };
}
