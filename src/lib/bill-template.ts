// What a restaurant's printed bill looks like. Stored as JSON in
// RestaurantSettings.billTemplate and edited on Settings → Bill design.
// Unknown or missing fields fall back to the defaults, so old saved templates
// keep working when new options are added.
import { z } from "zod";

export const PAPER_SIZES = ["58mm", "80mm", "a4"] as const;
export const FONT_STYLES = ["mono", "sans", "serif"] as const;
export const FONT_SIZES = ["small", "normal", "large"] as const;
export const LOGO_SIZES = ["small", "medium", "large"] as const;
export const ALIGNMENTS = ["center", "left"] as const;

export const billTemplateSchema = z.object({
  paperSize: z.enum(PAPER_SIZES),
  fontStyle: z.enum(FONT_STYLES),
  fontSize: z.enum(FONT_SIZES),
  headerAlign: z.enum(ALIGNMENTS),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour"),

  showLogo: z.boolean(),
  logoSize: z.enum(LOGO_SIZES),
  showRestaurantName: z.boolean(),
  showLegalName: z.boolean(),
  showAddress: z.boolean(),
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  showGstin: z.boolean(),
  showFssai: z.boolean(),
  headerText: z.string().max(300),
  billTitle: z.string().max(40),

  showBillNumber: z.boolean(),
  showDateTime: z.boolean(),
  showOrderType: z.boolean(),
  showTable: z.boolean(),
  showGuests: z.boolean(),
  showServedBy: z.boolean(),
  showCustomer: z.boolean(),

  showFoodTypeMark: z.boolean(),
  showItemNotes: z.boolean(),
  showRateColumn: z.boolean(),
  showItemCount: z.boolean(),

  showTaxBreakup: z.boolean(),
  showAmountInWords: z.boolean(),
  showPayments: z.boolean(),
  showUpiQr: z.boolean(),
  upiQrText: z.string().max(80),

  footerText: z.string().max(300),
  showPoweredBy: z.boolean(),
});

export type BillTemplate = z.infer<typeof billTemplateSchema>;

export const DEFAULT_BILL_TEMPLATE: BillTemplate = {
  paperSize: "80mm",
  fontStyle: "mono",
  fontSize: "normal",
  headerAlign: "center",
  accentColor: "#111827",

  showLogo: true,
  logoSize: "medium",
  showRestaurantName: true,
  showLegalName: false,
  showAddress: true,
  showPhone: true,
  showEmail: false,
  showGstin: true,
  showFssai: true,
  headerText: "",
  billTitle: "TAX INVOICE",

  showBillNumber: true,
  showDateTime: true,
  showOrderType: true,
  showTable: true,
  showGuests: false,
  showServedBy: true,
  showCustomer: true,

  showFoodTypeMark: false,
  showItemNotes: false,
  showRateColumn: true,
  showItemCount: true,

  showTaxBreakup: true,
  showAmountInWords: false,
  showPayments: true,
  showUpiQr: false,
  upiQrText: "Scan to pay with any UPI app",

  footerText: "Thank you! Please visit again.",
  showPoweredBy: false,
};

/** Ready-made starting points shown in the bill designer. */
export const BILL_PRESETS: Array<{ id: string; name: string; description: string; template: Partial<BillTemplate> }> = [
  {
    id: "classic",
    name: "Classic thermal",
    description: "The familiar 80 mm counter receipt with GST details.",
    template: { ...DEFAULT_BILL_TEMPLATE },
  },
  {
    id: "modern",
    name: "Modern café",
    description: "Clean sans-serif, bigger logo, veg marks and a UPI QR to pay.",
    template: {
      paperSize: "80mm",
      fontStyle: "sans",
      fontSize: "normal",
      headerAlign: "center",
      logoSize: "large",
      showFoodTypeMark: true,
      showItemNotes: true,
      showUpiQr: true,
      showGuests: true,
      billTitle: "BILL",
      footerText: "Loved your meal? Tell your friends!\nFollow us @ourcafe",
    },
  },
  {
    id: "compact",
    name: "Compact 58 mm",
    description: "For small 2-inch printers. Only the essentials.",
    template: {
      paperSize: "58mm",
      fontStyle: "mono",
      fontSize: "small",
      logoSize: "small",
      showEmail: false,
      showServedBy: false,
      showGuests: false,
      showRateColumn: false,
      showItemCount: false,
      showFoodTypeMark: false,
      showItemNotes: false,
      showAmountInWords: false,
    },
  },
  {
    id: "a4",
    name: "A4 invoice",
    description: "Full-page invoice for companies and catering orders, with amount in words.",
    template: {
      paperSize: "a4",
      fontStyle: "sans",
      fontSize: "normal",
      headerAlign: "left",
      accentColor: "#c2410c",
      logoSize: "medium",
      showLegalName: true,
      showEmail: true,
      showAmountInWords: true,
      showGuests: true,
      billTitle: "TAX INVOICE",
    },
  },
];

export function parseBillTemplate(json: string | null | undefined): BillTemplate {
  let saved: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(json || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch {
    // fall back to defaults
  }
  const result = { ...DEFAULT_BILL_TEMPLATE };
  const shape = billTemplateSchema.shape;
  for (const key of Object.keys(shape) as Array<keyof BillTemplate>) {
    const check = shape[key].safeParse(saved[key]);
    if (check.success) (result as Record<string, unknown>)[key] = check.data;
  }
  return result;
}
