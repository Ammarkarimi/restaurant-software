// CSV files for Excel (reports, customers, campaigns).

/**
 * One cell. Text that starts like a formula (=, +, -, @) — a guest's name, a note — could run as an
 * Excel formula when the file is opened, so it gets a leading ' and stays plain text. Numbers stay numbers.
 */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
