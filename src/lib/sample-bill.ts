import type { BillData } from "@/components/bill-view";
import { calculateBill } from "./billing";

interface SampleSettings {
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  roundOff: boolean;
  defaultTaxRate: number;
  billPrefix: string;
}

export const SAMPLE_ITEMS = [
  { name: "Paneer Tikka", variant: null, foodType: "veg", quantity: 1, price: 280, note: "Less spicy", taxRate: 5 },
  { name: "Chicken Biryani", variant: "Full", foodType: "non_veg", quantity: 2, price: 320, note: null, taxRate: 5 },
  { name: "Butter Naan", variant: null, foodType: "veg", quantity: 4, price: 45, note: null, taxRate: 5 },
  { name: "Masala Omelette", variant: null, foodType: "egg", quantity: 1, price: 90, note: null, taxRate: 5 },
  { name: "Fresh Lime Soda", variant: null, foodType: "veg", quantity: 2, price: 80, note: null, taxRate: 5 },
];

export function sampleBill(s: SampleSettings, paid: boolean): BillData {
  const rules = { taxMode: s.taxMode, pricesIncludeTax: s.pricesIncludeTax, serviceChargePercent: s.serviceChargePercent, roundOff: s.roundOff };
  const items = SAMPLE_ITEMS.map((i) => ({ ...i, taxRate: s.defaultTaxRate }));
  const totals = calculateBill(items, rules, { type: "percent", value: 10 });
  return {
    billNumber: `${s.billPrefix}1024`,
    orderNumber: 2318,
    type: "dine_in",
    tableName: "T4",
    guests: 4,
    servedBy: "Ravi",
    customerName: "Priya Sharma",
    customerPhone: "98765 43210",
    customerAddress: null,
    date: new Date(),
    items,
    totals,
    taxMode: s.taxMode,
    taxName: s.taxName,
    pricesIncludeTax: s.pricesIncludeTax,
    serviceChargePercent: s.serviceChargePercent,
    discountLabel: "10%",
    payments: paid ? [{ method: "upi", amount: totals.total }] : [],
    status: paid ? "settled" : "billed",
  };
}

