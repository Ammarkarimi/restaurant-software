// Turning a spreadsheet (or what the AI read off a menu photo) into dishes to add.
// Shared by the browser (preview) and the server (saving).
import { z } from "zod";

export type FoodType = "veg" | "non_veg" | "egg";

export interface ImportRow {
  name: string;
  price: number;
  category: string;
  foodType: FoodType;
  shortCode?: string;
  description?: string;
  variants?: Array<{ name: string; price: number }>;
}

export const importRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(0).max(10_000_000),
  category: z.string().trim().min(1).max(60),
  foodType: z.enum(["veg", "non_veg", "egg"]).default("veg"),
  shortCode: z.string().trim().max(12).optional(),
  description: z.string().trim().max(500).optional(),
  variants: z
    .array(z.object({ name: z.string().trim().min(1).max(40), price: z.coerce.number().min(0).max(10_000_000) }))
    .max(10)
    .optional(),
});

type Cell = string | number | boolean | Date | null | undefined;

const norm = (v: Cell) => (v === null || v === undefined ? "" : String(v).trim());
const key = (v: Cell) => norm(v).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Header words people use in their own sheets (Petpooja / Excel exports, hand-made lists). */
const HEADERS: Record<string, string[]> = {
  name: ["name", "item", "itemname", "dish", "dishname", "product", "productname", "menuitem", "particulars"],
  price: ["price", "rate", "mrp", "amount", "sellingprice", "baseprice", "cost", "pricers", "priceinr"],
  category: ["category", "categoryname", "section", "group", "menucategory", "menusection", "itemcategory"],
  foodType: ["type", "foodtype", "veg", "vegnonveg", "vegnv", "dietary", "itemtype", "attribute", "vegornonveg"],
  shortCode: ["code", "shortcode", "itemcode", "sku"],
  description: ["description", "desc", "details", "about"],
};

/** Columns holding portion prices, e.g. "Half" and "Full", become portions of the dish. */
const PORTION_HEADERS = ["half", "full", "quarter", "small", "medium", "large", "regular", "single", "double", "plate", "halfplate", "fullplate", "glass", "bottle", "piece", "pcs", "2pcs", "4pcs", "6pcs", "8pcs"];

const FOOD: Record<string, FoodType> = {
  veg: "veg",
  v: "veg",
  vegetarian: "veg",
  pureveg: "veg",
  green: "veg",
  nonveg: "non_veg",
  nv: "non_veg",
  nonvegetarian: "non_veg",
  n: "non_veg",
  red: "non_veg",
  egg: "egg",
  e: "egg",
  eggetarian: "egg",
  containsegg: "egg",
};

export function foodTypeOf(v: Cell): FoodType | null {
  return FOOD[key(v)] ?? null;
}

export function priceOf(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  const s = norm(v).replace(/,/g, "");
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  return m ? Number(m[1]) : null;
}

/** Tidies spacing, and turns ALL-CAPS headings like "MAIN COURSE" into "Main Course". */
function titleCase(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 4 || t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t;
  return t.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

export interface SheetResult {
  rows: ImportRow[];
  errors: string[];
  /** How the columns were read, shown under the preview so the owner can check. */
  columns: string;
}

/**
 * Reads rows of cells from an Excel / CSV sheet. A first row with headers like "Item Name, Price,
 * Category, Veg/Non-veg" is understood in any order; without one the columns are taken as
 * name, price, category, veg / non-veg, short code. Columns named Half / Full become portions.
 * A row with a name but no price, and nothing else, is read as a category heading ("STARTERS").
 */
export function rowsFromSheet(sheet: Cell[][], defaultCategory: string): SheetResult {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const lines = sheet.filter((r) => r.some((c) => norm(c)));
  if (!lines.length) return { rows, errors: ["The sheet is empty."], columns: "" };

  // Find the header row in the first few lines.
  let headerAt = -1;
  let col: Partial<Record<keyof typeof HEADERS, number>> = {};
  let portions: Array<{ index: number; name: string }> = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const found: typeof col = {};
    const ports: typeof portions = [];
    lines[i].forEach((c, j) => {
      const k = key(c);
      for (const [field, words] of Object.entries(HEADERS)) {
        if (found[field as keyof typeof HEADERS] === undefined && words.includes(k)) {
          found[field as keyof typeof HEADERS] = j;
          return;
        }
      }
      if (PORTION_HEADERS.includes(k) || /^(half|full)(price|rate)?$/.test(k)) ports.push({ index: j, name: titleCase(norm(c).replace(/\s*(price|rate)$/i, "")) });
    });
    if (found.name !== undefined && (found.price !== undefined || ports.length)) {
      headerAt = i;
      col = found;
      portions = ports;
      break;
    }
  }
  if (headerAt === -1) col = { name: 0, price: 1, category: 2, foodType: 3, shortCode: 4 };

  const used = Object.entries(col)
    .map(([f, j]) => `${{ name: "name", price: "price", category: "category", foodType: "veg / non-veg", shortCode: "code", description: "description" }[f]} = column ${String.fromCharCode(65 + (j as number))}`)
    .concat(portions.map((p) => `${p.name} portion = column ${String.fromCharCode(65 + p.index)}`));
  const columns = headerAt === -1 ? "No header row found, so columns are read as: name, price, category, veg / non-veg, code." : `Read ${used.join(", ")}.`;

  let heading: string | null = null;
  lines.slice(headerAt + 1).forEach((cells, i) => {
    const lineNo = headerAt + i + 2;
    const at = (j: number | undefined) => (j === undefined ? "" : norm(cells[j]));
    const name = at(col.name);
    const price = col.price === undefined ? null : priceOf(cells[col.price]);
    const variants = portions.flatMap((p) => {
      const v = priceOf(cells[p.index]);
      return v !== null && v > 0 ? [{ name: p.name, price: v }] : [];
    });
    if (!name) return;
    const others = cells.filter((c, j) => j !== col.name && norm(c)).length;
    if (price === null && !variants.length) {
      // "STARTERS" on its own line = the dishes below belong to Starters.
      if (others === 0) heading = titleCase(name);
      else errors.push(`Row ${lineNo}: "${name}" has no price.`);
      return;
    }
    const category = titleCase(at(col.category) || heading || defaultCategory).slice(0, 60);
    const food = foodTypeOf(cells[col.foodType ?? -1]) ?? guessFoodType(name);
    rows.push({
      name: titleCase(name).slice(0, 120),
      price: variants.length ? Math.min(...variants.map((v) => v.price)) : price!,
      category,
      foodType: food,
      shortCode: at(col.shortCode) ? at(col.shortCode).slice(0, 12).toUpperCase() : undefined,
      description: at(col.description) ? at(col.description).slice(0, 500) : undefined,
      variants: variants.length > 1 ? variants : undefined,
    });
  });
  return { rows, errors, columns };
}

const NON_VEG_WORDS = /\b(chicken|mutton|lamb|fish|prawn|prawns|shrimp|crab|keema|gosht|meat|beef|pork|bacon|ham|salami|pepperoni|tuna|salmon|murg|murgh|kebab\s+chicken|seekh|tangdi|tandoori\s+chicken|bheja|nalli|paya|kheema|surmai|pomfret|bangda|rawas|squid|calamari|lobster|turkey|duck|quail)\b/i;
const EGG_WORDS = /\b(egg|eggs|anda|omelette|omelet|bhurji)\b/i;

/** When the sheet has no veg column: "Chicken 65" is non-veg, "Egg Curry" is egg, the rest veg. */
export function guessFoodType(name: string): FoodType {
  if (NON_VEG_WORDS.test(name)) return "non_veg";
  if (EGG_WORDS.test(name)) return "egg";
  return "veg";
}

/** Reads a CSV file's text into cells (handles quotes and commas inside quotes). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delimiter = !text.includes(",") && text.includes(";") ? ";" : text.split("\n")[0].includes("\t") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/** Marks rows that are already on the menu (same name in the same category), so they are skipped. */
export function markDuplicates<T extends ImportRow>(rows: T[], existing: Array<{ name: string; category: string }>) {
  const seen = new Set(existing.map((e) => `${e.category.toLowerCase()}|${e.name.toLowerCase()}`));
  return rows.map((r) => {
    const k = `${r.category.toLowerCase()}|${r.name.toLowerCase()}`;
    const duplicate = seen.has(k);
    seen.add(k);
    return { ...r, duplicate };
  });
}
