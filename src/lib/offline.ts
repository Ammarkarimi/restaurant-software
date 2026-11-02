// Billing while the internet is down: what a counter keeps on the device, and the shape of a bill
// it saved offline. Shared by the browser (offline screen) and the server (sync).
import { z } from "zod";
import { calculateBill, type BillTotals } from "./billing";

export interface OfflineMenuItem {
  id: string;
  name: string;
  shortCode: string | null;
  category: string;
  price: number;
  variants: Array<{ name: string; price: number }>;
  foodType: string;
  taxRate: number;
  available: boolean;
}

export interface OfflineRules {
  taxMode: string;
  taxName: string;
  pricesIncludeTax: boolean;
  serviceChargePercent: number;
  roundOff: boolean;
  packingCharge: number;
  deliveryCharge: number;
  chargeTaxRate: number;
}

export interface OfflineBootstrap {
  savedAt: string;
  restaurant: { name: string; address: string | null; phone: string | null; gstin: string | null; fssai: string | null; currency: string; timezone: string; billPrefix: string; footer: string };
  rules: OfflineRules;
  menu: OfflineMenuItem[];
  tables: string[];
  user: { name: string };
}

export const offlineBillSchema = z.object({
  clientId: z.string().min(8).max(60),
  billNumber: z.string().min(1).max(40),
  type: z.enum(["dine_in", "takeaway", "delivery"]),
  tableName: z.string().trim().max(40).nullable().optional(),
  customerName: z.string().trim().max(100).nullable().optional(),
  customerPhone: z.string().trim().max(20).nullable().optional(),
  createdAt: z.coerce.date(),
  paidAt: z.coerce.date(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discount: z.coerce.number().min(0).max(10_000_000).default(0),
  rules: z.object({
    taxMode: z.string().max(10),
    taxName: z.string().max(20),
    pricesIncludeTax: z.boolean(),
    serviceChargePercent: z.number().min(0).max(50),
    roundOff: z.boolean(),
    packingCharge: z.number().min(0),
    deliveryCharge: z.number().min(0),
    chargeTaxRate: z.number().min(0).max(100),
  }),
  items: z
    .array(
      z.object({
        menuItemId: z.string().nullable(),
        name: z.string().trim().min(1).max(120),
        variant: z.string().trim().max(40).nullable().optional(),
        category: z.string().trim().max(60).nullable().optional(),
        foodType: z.string().max(10).default("veg"),
        price: z.number().min(0).max(10_000_000),
        quantity: z.number().int().min(1).max(1000),
        taxRate: z.number().min(0).max(100),
      })
    )
    .min(1)
    .max(200),
  payments: z.array(z.object({ method: z.enum(["cash", "upi", "card", "other"]), amount: z.number().positive().max(100_000_000) })).max(5),
  total: z.number().min(0),
});

export type OfflineBill = z.infer<typeof offlineBillSchema>;

/** The same bill maths the server uses, so a bill printed offline matches the synced one. */
export function offlineTotals(bill: Pick<OfflineBill, "items" | "rules" | "discount" | "type">): BillTotals {
  const r = bill.rules;
  return calculateBill(
    bill.items.map((i) => ({ price: i.price, quantity: i.quantity, taxRate: i.taxRate })),
    { taxMode: r.taxMode, pricesIncludeTax: r.pricesIncludeTax, serviceChargePercent: r.serviceChargePercent, roundOff: r.roundOff },
    bill.discount ? { type: "amount", value: bill.discount } : null,
    {
      charges: [
        { name: "Packing charge", amount: bill.type === "dine_in" ? 0 : r.packingCharge, taxRate: r.chargeTaxRate },
        { name: "Delivery charge", amount: bill.type === "delivery" ? r.deliveryCharge : 0, taxRate: r.chargeTaxRate },
      ],
    }
  );
}
