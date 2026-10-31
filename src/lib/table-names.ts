// Table names must differ across the whole restaurant: kitchen tickets, bills and the guest's QR page
// show only the name ("TABLE T3"), so two floors can't both have a T3. These helpers suggest free names.

const FILLER = new Set(["hall", "floor", "area", "section", "room", "side", "zone", "level"]);

/** A short start for table names in an area: "First Floor" → "F", "Garden" → "G", "AC hall" → "AC". */
export function areaPrefix(area: string): string {
  const words = area.trim().split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !FILLER.has(w.toLowerCase()));
  const pick = main.length ? main : words;
  if (!pick.length) return "T";
  const first = pick[0];
  const prefix = /^[A-Z0-9]{2,4}$/.test(first) ? first : first[0].toUpperCase();
  // "Floor 2" → "F2-", so its tables read F2-1, F2-2 rather than 21, 22.
  return /\d$/.test(prefix) ? `${words.map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase())).join("").slice(0, 4)}-` : prefix;
}

/** Names like T1 … T5. */
export function tableRange(prefix: string, from: number, to: number): string[] {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`${prefix}${n}`);
  return out;
}

export interface TableNameOption {
  prefix: string;
  from: number;
  to: number;
}

/**
 * Free names for `count` tables when the asked-for ones are taken: the area's own start first
 * (F1 … F5 for a new "First Floor", or what an existing area already uses), then the same start
 * carried on after the last number in use (T11 … T15).
 */
export function freeTableNames(tables: Array<{ name: string; area: string }>, prefix: string, count: number, area: string): TableNameOption[] {
  const existing = tables.map((t) => t.name);
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const free = (p: string, from: number) => tableRange(p, from, from + count - 1).every((n) => !taken.has(n.toLowerCase()));
  const options: TableNameOption[] = [];
  const inArea = tables.filter((t) => t.area.trim().toLowerCase() === area.trim().toLowerCase());
  const used = inArea.map((t) => /^(.*?)\d+$/.exec(t.name)?.[1]).filter((x): x is string => x !== undefined);
  const lastNumber = (p: string) => {
    const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i");
    return existing.reduce((max, n) => Math.max(max, Number(re.exec(n)?.[1] ?? 0)), 0);
  };
  // An area that already has tables carries on its own numbering (G3, G4…); a new area starts at 1 (F1…).
  const letter = used.length ? mostCommon(used) : areaPrefix(area);
  const start = used.length ? lastNumber(letter) + 1 : 1;
  if (letter.toLowerCase() !== prefix.toLowerCase() && free(letter, start)) options.push({ prefix: letter, from: start, to: start + count - 1 });
  const next = lastNumber(prefix) + 1;
  if (free(prefix, next)) options.push({ prefix, from: next, to: next + count - 1 });
  return options;
}

function mostCommon(list: string[]) {
  const counts = new Map<string, number>();
  for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function rangeLabel(o: TableNameOption) {
  return o.from === o.to ? `${o.prefix}${o.from}` : `${o.prefix}${o.from} … ${o.prefix}${o.to}`;
}
