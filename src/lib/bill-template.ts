// What a restaurant's printed bill looks like. Stored as JSON in
// RestaurantSettings.billTemplate and edited on Settings → Bill design.
// Unknown or missing fields fall back to the defaults, so old saved templates
// keep working when new options are added.
import { z } from "zod";

// The first three are the original choices: their saved value and how they print never change.
export const PAPER_SIZES = ["80mm", "58mm", "a4", "letter", "postcard", "roll58x297", "roll58x3276", "roll80x297", "roll80x3276", "custom"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

/** Names match what printer drivers show in their paper list. */
export const PAPER_OPTIONS: Array<[PaperSize, string]> = [
  ["80mm", "80 mm thermal roll (3 inch)"],
  ["58mm", "58 mm thermal roll (2 inch)"],
  ["a4", "A4 210 × 297 mm"],
  ["letter", "Letter 8.5 × 11 in"],
  ["postcard", "Postcard 100 × 148 mm"],
  ["roll58x297", "Roll paper 58 × 297 mm"],
  ["roll58x3276", "Roll paper 58 × 3276 mm"],
  ["roll80x297", "Roll paper 80 × 297 mm"],
  ["roll80x3276", "Roll paper 80 × 3276 mm"],
  ["custom", "Custom size…"],
];

export const CUSTOM_PAPER_WIDTH = { min: 40, max: 320 } as const;
export const CUSTOM_PAPER_HEIGHT = { max: 3300 } as const;
export const FONT_STYLES = ["mono", "sans", "serif"] as const;
export const FONT_SIZES = ["small", "normal", "large"] as const;
export const LOGO_SIZES = ["small", "medium", "large"] as const;
export const ALIGNMENTS = ["center", "left"] as const;

export const billTemplateSchema = z.object({
  paperSize: z.enum(PAPER_SIZES),
  /** Custom paper only, in mm. Height 0 means a continuous roll: the printer decides where to cut. */
  customPaperWidth: z.coerce.number().int().min(CUSTOM_PAPER_WIDTH.min).max(CUSTOM_PAPER_WIDTH.max).default(80),
  customPaperHeight: z.coerce.number().int().min(0).max(CUSTOM_PAPER_HEIGHT.max).default(0),
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
  customPaperWidth: 80,
  customPaperHeight: 0,
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

/** How a paper size prints: the bill's layout, its width on the paper and the page rule for the browser. */
export interface PaperSpec {
  /** "receipt" is the narrow counter slip; "page" is the full-page invoice (A4, Letter, wide custom paper). */
  layout: "receipt" | "page";
  /** Width of the printed bill, in mm. */
  widthMm: number;
  padding: string;
  /** A 2-inch roll: smaller QR code and a 58 mm kitchen ticket. */
  narrow: boolean;
  pageCss: string;
}

const PAGE_MARGIN_MM = 12;

function receipt(widthMm: number, pageCss: string, padding?: string): PaperSpec {
  const narrow = widthMm <= 60;
  return { layout: "receipt", widthMm, padding: padding ?? (narrow ? "2mm" : "3mm"), narrow, pageCss };
}

function page(pageWidthMm: number, pageCss: string): PaperSpec {
  return { layout: "page", widthMm: Math.min(190, pageWidthMm - 2 * PAGE_MARGIN_MM), padding: "0", narrow: false, pageCss };
}

export function paperSpec(t: Pick<BillTemplate, "paperSize" | "customPaperWidth" | "customPaperHeight">): PaperSpec {
  switch (t.paperSize) {
    // Unchanged from before more sizes were added, so existing restaurants print exactly as they did.
    case "80mm":
      return receipt(80, "@page { size: 80mm auto; margin: 0; }");
    case "58mm":
      return receipt(58, "@page { size: 58mm auto; margin: 0; }");
    case "a4":
      return page(214, `@page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }`);
    case "letter":
      return page(216, `@page { size: letter; margin: ${PAGE_MARGIN_MM}mm; }`);
    case "postcard":
      return receipt(100, "@page { size: 100mm 148mm; margin: 0; }", "4mm");
    case "roll58x297":
      return receipt(58, "@page { size: 58mm 297mm; margin: 0; }");
    case "roll58x3276":
      return receipt(58, "@page { size: 58mm 3276mm; margin: 0; }");
    case "roll80x297":
      return receipt(80, "@page { size: 80mm 297mm; margin: 0; }");
    case "roll80x3276":
      return receipt(80, "@page { size: 80mm 3276mm; margin: 0; }");
    case "custom": {
      const w = Math.round(Math.min(CUSTOM_PAPER_WIDTH.max, Math.max(CUSTOM_PAPER_WIDTH.min, t.customPaperWidth || 80)));
      const h = Math.round(Math.min(CUSTOM_PAPER_HEIGHT.max, Math.max(0, t.customPaperHeight || 0)));
      // Wide paper gets the invoice layout with page margins; narrow paper prints edge to edge like a roll.
      if (w >= 150) return page(w, `@page { ${h ? `size: ${w}mm ${h}mm; ` : ""}margin: ${PAGE_MARGIN_MM}mm; }`);
      return receipt(w, `@page { ${h ? `size: ${w}mm ${h}mm; ` : ""}margin: 0; }`);
    }
  }
}

/** Kitchen tickets and the day summary always print as a roll slip, 58 or 80 mm wide to match the bill printer. */
export function slipWidth(t: BillTemplate): "58mm" | "80mm" {
  return paperSpec(t).narrow ? "58mm" : "80mm";
}
