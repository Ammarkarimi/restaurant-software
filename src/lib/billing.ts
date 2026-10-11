// Bill maths for a restaurant order. One function used by the POS screen, the
// printed bill and the server, so the three can never disagree.
//
// For each line:
//   gross        = unit price × quantity (the menu price)
//   afterDisc    = gross − its share of the bill discount
//   base         = afterDisc, or afterDisc without tax when menu prices include tax
//   service      = base × service charge %
//   taxable      = base + service             (service charge is taxed like the food)
//   tax          = taxable × the item's tax rate
// Grand total = Σ (taxable + tax), then rounded to the nearest whole amount if asked.

export interface BillLineInput {
  price: number;
  quantity: number;
  taxRate: number;
}

export interface BillRules {
  taxMode: string; // gst, simple, none
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  roundOff: boolean;
}

export interface BillDiscount {
  type: string; // percent, amount
  value: number;
}

export interface TaxLine {
  rate: number;
  taxable: number;
  tax: number;
}

export interface BillTotals {
  /** Sum of menu prices × quantity. */
  itemsTotal: number;
  discount: number;
  /** Service charge before tax. */
  serviceCharge: number;
  /** Tax on the service charge (part of `tax`). */
  serviceChargeTax: number;
  /** Amount tax is calculated on (food after discount, without tax, plus service charge). */
  taxable: number;
  tax: number;
  /** Tax grouped by rate, for the GST summary. Empty when there is no tax. */
  taxLines: TaxLine[];
  /** Before rounding. */
  exactTotal: number;
  roundOff: number;
  total: number;
  itemCount: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function discountAmount(itemsTotal: number, discount: BillDiscount | null | undefined): number {
  if (!discount || !(discount.value > 0) || itemsTotal <= 0) return 0;
  const amount = discount.type === "amount" ? discount.value : (itemsTotal * Math.min(discount.value, 100)) / 100;
  return round2(Math.min(amount, itemsTotal));
}

export function calculateBill(lines: BillLineInput[], rules: BillRules, discount?: BillDiscount | null): BillTotals {
  const items = lines.filter((l) => l.quantity > 0);
  const itemsTotal = round2(items.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const discount$ = discountAmount(itemsTotal, discount);
  const discountShare = itemsTotal > 0 ? discount$ / itemsTotal : 0;
  const taxed = rules.taxMode !== "none";
  const sc = Math.max(0, rules.serviceChargePercent || 0) / 100;

  let serviceCharge = 0;
  let serviceChargeTax = 0;
  let foodBase = 0;
  const byRate = new Map<number, TaxLine>();

  for (const l of items) {
    const rate = taxed ? Math.max(0, l.taxRate || 0) : 0;
    const afterDisc = l.price * l.quantity * (1 - discountShare);
    const base = rules.pricesIncludeTax ? afterDisc / (1 + rate / 100) : afterDisc;
    const service = base * sc;
    const taxable = base + service;
    const tax = (taxable * rate) / 100;
    foodBase += base;
    serviceCharge += service;
    serviceChargeTax += (service * rate) / 100;
    if (taxed && rate > 0) {
      const t = byRate.get(rate) ?? { rate, taxable: 0, tax: 0 };
      t.taxable += taxable;
      t.tax += tax;
      byRate.set(rate, t);
    }
  }

  const taxLines = [...byRate.values()]
    .sort((a, b) => a.rate - b.rate)
    .map((t) => ({ rate: t.rate, taxable: round2(t.taxable), tax: round2(t.tax) }));
  const tax = round2(taxLines.reduce((sum, t) => sum + t.tax, 0));
  serviceCharge = round2(serviceCharge);
  const taxable = round2(foodBase + serviceCharge);
  const exactTotal = round2(taxable + tax);
  const total = rules.roundOff ? Math.round(exactTotal) : exactTotal;

  return {
    itemsTotal,
    discount: discount$,
    serviceCharge,
    serviceChargeTax: round2(serviceChargeTax),
    taxable,
    tax,
    taxLines,
    exactTotal,
    roundOff: round2(total - exactTotal),
    total,
    itemCount: items.reduce((sum, l) => sum + l.quantity, 0),
  };
}

/** "CGST @2.5%" / "SGST @2.5%" for GST, or one line with the tax name. */
export function taxRowsFor(totals: BillTotals, taxMode: string, taxName = "Tax"): Array<{ label: string; amount: number }> {
  if (taxMode === "none") return [];
  const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, "")}%`;
  if (taxMode === "gst") {
    return totals.taxLines.flatMap((t) => {
      const half = round2(t.tax / 2);
      return [
        { label: `CGST @${fmt(t.rate / 2)}`, amount: half },
        { label: `SGST @${fmt(t.rate / 2)}`, amount: round2(t.tax - half) },
      ];
    });
  }
  return totals.taxLines.map((t) => ({ label: `${taxName} @${fmt(t.rate)}`, amount: t.tax }));
}

export function paidAmount(payments: Array<{ amount: number }>) {
  return round2(payments.reduce((sum, p) => sum + p.amount, 0));
}
