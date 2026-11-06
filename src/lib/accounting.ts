// Files for the accountant: GSTR-1 tables (in the GST offline tool's CSV layout) and a Tally
// import file (XML) with the day's sales, tax and payments. Pure functions, so they are tested.

export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isGstin(v: string | null | undefined): boolean {
  return GSTIN_RE.test((v ?? "").trim().toUpperCase());
}

/** "27-Maharashtra", from the first two digits of a GSTIN. */
export function placeOfSupply(gstin: string | null | undefined): string | null {
  const code = (gstin ?? "").trim().slice(0, 2);
  return GST_STATES[code] ? `${code}-${GST_STATES[code]}` : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-05" → "05-Nov-2026" (the date style the GST offline tool wants). */
export function gstDate(key: string) {
  const [y, m, d] = key.split("-");
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface AccountingBill {
  billNumber: string;
  date: string; // business day
  total: number;
  taxable: number;
  tax: number;
  roundOff: number;
  /** sac: the service code of the line when it is not restaurant service (e.g. 997212 for hall rent). */
  taxLines: Array<{ rate: number; taxable: number; tax: number; sac?: string }>;
  payments: Array<{ method: string; amount: number }>;
  customerGstin: string | null;
  customerName: string | null;
  /** zomato / swiggy: GST on these is paid by the app (section 9(5)), so they are kept apart. */
  source: string;
  taxMode: string;
}

export const ECO_SOURCES = new Set(["zomato", "swiggy"]);

export interface Gstr1 {
  b2b: Array<Array<string | number>>;
  b2cs: Array<Array<string | number>>;
  hsn: Array<Array<string | number>>;
  docs: Array<Array<string | number>>;
  eco: Array<Array<string | number>>;
  summary: { b2bBills: number; b2cBills: number; ecoBills: number; taxable: number; tax: number; pos: string | null };
}

/**
 * GSTR-1 tables for a month (or any period). A restaurant's supply is always inside its own state,
 * so tax is CGST + SGST and the place of supply is the restaurant's state.
 */
export function buildGstr1(bills: AccountingBill[], opts: { gstin: string | null; sacCode: string; cancelled: string[]; allBillNumbers: string[] }): Gstr1 {
  const pos = placeOfSupply(opts.gstin) ?? "";
  const gst = bills.filter((b) => b.taxMode === "gst");
  const eco = gst.filter((b) => ECO_SOURCES.has(b.source));
  const own = gst.filter((b) => !ECO_SOURCES.has(b.source));
  const b2bBills = own.filter((b) => isGstin(b.customerGstin));
  const b2cBills = own.filter((b) => !isGstin(b.customerGstin));

  const b2b: Gstr1["b2b"] = [["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"]];
  for (const b of b2bBills) {
    for (const t of b.taxLines.filter((l) => l.taxable > 0)) {
      b2b.push([b.customerGstin!.trim().toUpperCase(), b.customerName ?? "", b.billNumber, gstDate(b.date), r2(b.total), pos, "N", "", "Regular B2B", "", t.rate, r2(t.taxable), 0]);
    }
  }

  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const b of b2cBills) for (const t of b.taxLines) {
    const x = byRate.get(t.rate) ?? { taxable: 0, tax: 0 };
    x.taxable += t.taxable;
    x.tax += t.tax;
    byRate.set(t.rate, x);
  }
  const b2cs: Gstr1["b2cs"] = [["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"]];
  for (const [rate, x] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) if (x.taxable > 0) b2cs.push(["OE", pos, "", rate, r2(x.taxable), 0, ""]);

  // HSN / SAC summary: restaurant service, plus hall rent etc. for banquets; services have no quantity (UQC "NA").
  const SAC_NAMES: Record<string, string> = { "997212": "Hall rent (rental of non-residential property)" };
  const hsnRows = new Map<string, { sac: string; rate: number; value: number; taxable: number; tax: number }>();
  for (const b of own) for (const t of b.taxLines) {
    const sac = t.sac ?? opts.sacCode;
    const k = `${sac}|${t.rate}`;
    const x = hsnRows.get(k) ?? { sac, rate: t.rate, value: 0, taxable: 0, tax: 0 };
    x.value += t.taxable + t.tax;
    x.taxable += t.taxable;
    x.tax += t.tax;
    hsnRows.set(k, x);
  }
  const hsn: Gstr1["hsn"] = [["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"]];
  for (const x of [...hsnRows.values()].sort((a, b) => a.sac.localeCompare(b.sac) || a.rate - b.rate)) {
    const half = r2(x.tax / 2);
    hsn.push([x.sac, SAC_NAMES[x.sac] ?? "Restaurant service", "NA", 0, r2(x.value), x.rate, r2(x.taxable), 0, half, r2(x.tax - half), 0]);
  }

  // Documents issued: the bill number series, from the first to the last, with cancelled ones.
  const docs: Gstr1["docs"] = [["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"]];
  for (const s of billSeries(opts.allBillNumbers)) {
    const cancelled = opts.cancelled.filter((n) => s.numbers.has(n)).length;
    docs.push(["Invoices for outward supply", s.from, s.to, s.numbers.size, cancelled]);
  }

  const ecoRows: Gstr1["eco"] = [["App", "Bills", "Value (incl. any tax charged)", "Note"]];
  for (const src of ECO_SOURCES) {
    const list = eco.filter((b) => b.source === src);
    if (list.length) ecoRows.push([src === "zomato" ? "Zomato" : "Swiggy", list.length, r2(list.reduce((s, b) => s + b.total, 0)), "GST on these orders is paid by the app under section 9(5); report them as supplies through e-commerce operators (table 14)."]);
  }

  return {
    b2b,
    b2cs,
    hsn,
    docs,
    eco: ecoRows,
    summary: {
      b2bBills: b2bBills.length,
      b2cBills: b2cBills.length,
      ecoBills: eco.length,
      taxable: r2(own.reduce((s, b) => s + b.taxLines.reduce((x, t) => x + t.taxable, 0), 0)),
      tax: r2(own.reduce((s, b) => s + b.tax, 0)),
      pos: pos || null,
    },
  };
}

/** Groups bill numbers into series by prefix: "B-101 … B-180". */
export function billSeries(numbers: string[]) {
  const series = new Map<string, { prefix: string; min: number; max: number; from: string; to: string; numbers: Set<string> }>();
  for (const n of numbers) {
    const m = /^(.*?)(\d+)$/.exec(n);
    const prefix = m ? m[1] : n;
    const num = m ? Number(m[2]) : 0;
    const s = series.get(prefix) ?? { prefix, min: Infinity, max: -Infinity, from: n, to: n, numbers: new Set<string>() };
    if (num < s.min) {
      s.min = num;
      s.from = n;
    }
    if (num > s.max) {
      s.max = num;
      s.to = n;
    }
    s.numbers.add(n);
    series.set(prefix, s);
  }
  return [...series.values()];
}

// ---------- Tally ----------

export const TALLY_LEDGERS = {
  sales: "Restaurant Sales",
  cgst: "Output CGST",
  sgst: "Output SGST",
  tax: "Output Tax",
  roundOff: "Round Off",
  cash: "Cash",
  upi: "UPI Collections",
  card: "Card Collections",
  online: "Online Payments",
  account: "Customer Accounts",
  other: "Other Receipts",
  zomato: "Zomato",
  swiggy: "Swiggy",
} as const;

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const amt = (n: number) => r2(n).toFixed(2);

interface Entry {
  ledger: string;
  /** Positive = credit (sales, tax), negative = debit (cash, bank). */
  amount: number;
}

/** Ledger lines of one sales voucher: money in (debit), sales and tax (credit), round off. They add up to zero. */
export function voucherEntries(bills: AccountingBill[], gst: boolean): Entry[] {
  const debit = new Map<string, number>();
  let sales = 0;
  let tax = 0;
  for (const b of bills) {
    for (const p of b.payments) {
      // Zomato / Swiggy orders are paid out by the app, so they are owed by its ledger.
      const ledger = ECO_SOURCES.has(b.source) && (p.method === "online" || p.method === "other") ? TALLY_LEDGERS[b.source as "zomato"] : (TALLY_LEDGERS[p.method as keyof typeof TALLY_LEDGERS] ?? TALLY_LEDGERS.other);
      debit.set(ledger, (debit.get(ledger) ?? 0) + p.amount);
    }
    // A bill with nothing paid (complimentary) adds nothing.
    if (!b.payments.length) continue;
    sales += b.taxable;
    tax += b.tax;
  }
  const entries: Entry[] = [...debit.entries()].map(([ledger, a]) => ({ ledger, amount: -r2(a) }));
  entries.push({ ledger: TALLY_LEDGERS.sales, amount: r2(sales) });
  if (gst && tax) {
    const half = r2(tax / 2);
    entries.push({ ledger: TALLY_LEDGERS.cgst, amount: half }, { ledger: TALLY_LEDGERS.sgst, amount: r2(tax - half) });
  } else if (tax) entries.push({ ledger: TALLY_LEDGERS.tax, amount: r2(tax) });
  // Whatever is left (round off, paise differences) goes to Round Off so the voucher balances.
  const rest = r2(-entries.reduce((s, e) => s + e.amount, 0));
  if (Math.abs(rest) >= 0.005) entries.push({ ledger: TALLY_LEDGERS.roundOff, amount: rest });
  return entries;
}

function voucherXml(date: string, number: string, narration: string, entries: Entry[]) {
  const party = entries.find((e) => e.amount < 0)?.ledger ?? TALLY_LEDGERS.cash;
  return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
<DATE>${date.replace(/-/g, "")}</DATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(number)}</VOUCHERNUMBER>
<PARTYLEDGERNAME>${xml(party)}</PARTYLEDGERNAME><PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><NARRATION>${xml(narration)}</NARRATION>
${entries
  .map((e) => `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(e.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${e.amount < 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${amt(e.amount)}</AMOUNT></ALLLEDGERENTRIES.LIST>`)
  .join("\n")}
</VOUCHER></TALLYMESSAGE>`;
}

function envelope(company: string, body: string, report = "Vouchers") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>${report}</REPORTNAME>${company ? `<STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}</REQUESTDESC><REQUESTDATA>
${body}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

/** Sales vouchers for Tally: one per day (the usual way for restaurants) or one per bill. */
export function tallyVouchers(bills: AccountingBill[], opts: { company: string; perBill: boolean; gst: boolean }) {
  const parts: string[] = [];
  if (opts.perBill) {
    for (const b of bills) if (b.payments.length) parts.push(voucherXml(b.date, b.billNumber, `Bill ${b.billNumber}`, voucherEntries([b], opts.gst)));
  } else {
    const days = new Map<string, AccountingBill[]>();
    for (const b of bills) days.set(b.date, [...(days.get(b.date) ?? []), b]);
    for (const [date, list] of [...days.entries()].sort()) {
      const paid = list.filter((b) => b.payments.length);
      if (!paid.length) continue;
      const nums = paid.map((b) => b.billNumber);
      parts.push(voucherXml(date, `DAY-${date}`, `Sales ${date}: ${paid.length} bills (${nums[0]} to ${nums[nums.length - 1]})`, voucherEntries(paid, opts.gst)));
    }
  }
  return envelope(opts.company, parts.join("\n"));
}

/** The ledgers the vouchers use, to import once before the first vouchers file. */
export function tallyLedgers(company: string, gst: boolean) {
  const list: Array<{ name: string; parent: string; tax?: string }> = [
    { name: TALLY_LEDGERS.sales, parent: "Sales Accounts" },
    ...(gst ? [{ name: TALLY_LEDGERS.cgst, parent: "Duties & Taxes", tax: "Central Tax" }, { name: TALLY_LEDGERS.sgst, parent: "Duties & Taxes", tax: "State Tax" }] : [{ name: TALLY_LEDGERS.tax, parent: "Duties & Taxes" }]),
    { name: TALLY_LEDGERS.roundOff, parent: "Indirect Expenses" },
    { name: TALLY_LEDGERS.upi, parent: "Bank Accounts" },
    { name: TALLY_LEDGERS.card, parent: "Bank Accounts" },
    { name: TALLY_LEDGERS.online, parent: "Bank Accounts" },
    { name: TALLY_LEDGERS.account, parent: "Sundry Debtors" },
    { name: TALLY_LEDGERS.zomato, parent: "Sundry Debtors" },
    { name: TALLY_LEDGERS.swiggy, parent: "Sundry Debtors" },
    { name: TALLY_LEDGERS.other, parent: "Suspense A/c" },
  ];
  const body = list
    .map(
      (l) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xml(l.name)}" ACTION="Create"><NAME.LIST><NAME>${xml(l.name)}</NAME></NAME.LIST><PARENT>${xml(l.parent)}</PARENT>${
        l.tax ? `<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>${l.tax}</GSTDUTYHEAD>` : ""
      }<ISBILLWISEON>No</ISBILLWISEON></LEDGER></TALLYMESSAGE>`
    )
    .join("\n");
  return envelope(company, body, "All Masters");
}
