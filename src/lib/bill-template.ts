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
/** The printer's print area on a roll, in mm. 0 = worked out from the paper width. */
export const PRINT_WIDTH = { min: 30, max: 320 } as const;
export const FONT_STYLES = ["mono", "sans", "serif"] as const;
export const FONT_SIZES = ["small", "normal", "large"] as const;
export const LOGO_SIZES = ["small", "medium", "large"] as const;
export const ALIGNMENTS = ["center", "left"] as const;

export const billTemplateSchema = z.object({
  paperSize: z.enum(PAPER_SIZES),
  /** Custom paper only, in mm. Height 0 means a continuous roll: the printer decides where to cut. */
  customPaperWidth: z.coerce.number().int().min(CUSTOM_PAPER_WIDTH.min).max(CUSTOM_PAPER_WIDTH.max).default(80),
  customPaperHeight: z.coerce.number().int().min(0).max(CUSTOM_PAPER_HEIGHT.max).default(0),
  /** Width the printer can print on a roll, in mm (0 = 72 mm on 80 mm paper, 48 mm on 58 mm). */
  printWidth: z.coerce.number().min(0).max(PRINT_WIDTH.max).default(0),
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
  printWidth: 0,
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
  /** Width of the paper, in mm. */
  paperMm: number;
  /**
   * Width the bill's text is laid out to, in mm. On a receipt this is the printer's print area,
   * centred on the paper: thermal printers can't print the outer ~4 mm on each side of the roll.
   */
  widthMm: number;
  /** The print area the printer most likely has, used when the owner hasn't set one. */
  autoWidthMm: number;
  padding: string;
  /** A 2-inch roll: smaller QR code and a 58 mm kitchen ticket. */
  narrow: boolean;
  pageCss: string;
}

type PaperFields = Pick<BillTemplate, "paperSize" | "customPaperWidth" | "customPaperHeight"> & Partial<Pick<BillTemplate, "printWidth">>;

const PAGE_MARGIN_MM = 12;

/** 80 mm thermal printers print 72 mm (576 dots), 58 mm ones 48 mm (384 dots). */
export function autoPrintWidth(paperMm: number) {
  return paperMm <= 60 ? Math.max(30, paperMm - 10) : paperMm - 8;
}

function receipt(paperMm: number, pageCss: string, printWidth = 0): PaperSpec {
  const narrow = paperMm <= 60;
  const autoWidthMm = autoPrintWidth(paperMm);
  const widthMm = printWidth >= PRINT_WIDTH.min ? Math.min(printWidth, paperMm) : autoWidthMm;
  return { layout: "receipt", paperMm, widthMm, autoWidthMm, padding: "0 1mm", narrow, pageCss };
}

function page(pageWidthMm: number, pageCss: string): PaperSpec {
  const widthMm = Math.min(190, pageWidthMm - 2 * PAGE_MARGIN_MM);
  return { layout: "page", paperMm: pageWidthMm, widthMm, autoWidthMm: widthMm, padding: "0", narrow: false, pageCss };
}

export function paperSpec(t: PaperFields): PaperSpec {
  const pw = t.printWidth ?? 0;
  switch (t.paperSize) {
    // The page rules of the original three sizes are unchanged.
    case "80mm":
      return receipt(80, "@page { size: 80mm auto; margin: 0; }", pw);
    case "58mm":
      return receipt(58, "@page { size: 58mm auto; margin: 0; }", pw);
    case "a4":
      return page(214, `@page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }`);
    case "letter":
      return page(216, `@page { size: letter; margin: ${PAGE_MARGIN_MM}mm; }`);
    case "postcard":
      return receipt(100, "@page { size: 100mm 148mm; margin: 0; }", pw);
    case "roll58x297":
      return receipt(58, "@page { size: 58mm 297mm; margin: 0; }", pw);
    case "roll58x3276":
      return receipt(58, "@page { size: 58mm 3276mm; margin: 0; }", pw);
    case "roll80x297":
      return receipt(80, "@page { size: 80mm 297mm; margin: 0; }", pw);
    case "roll80x3276":
      return receipt(80, "@page { size: 80mm 3276mm; margin: 0; }", pw);
    case "custom": {
      const w = Math.round(Math.min(CUSTOM_PAPER_WIDTH.max, Math.max(CUSTOM_PAPER_WIDTH.min, t.customPaperWidth || 80)));
      const h = Math.round(Math.min(CUSTOM_PAPER_HEIGHT.max, Math.max(0, t.customPaperHeight || 0)));
      // Wide paper gets the invoice layout with page margins; narrow paper prints like a roll.
      if (w >= 150) return page(w, `@page { ${h ? `size: ${w}mm ${h}mm; ` : ""}margin: ${PAGE_MARGIN_MM}mm; }`);
      return receipt(w, `@page { ${h ? `size: ${w}mm ${h}mm; ` : ""}margin: 0; }`, pw);
    }
  }
}

/** Kitchen tickets and the day summary print as a roll slip with the same print area as the bill. */
export function slipSpec(t: BillTemplate): { paper: "58mm" | "80mm"; widthMm: number; width: string; padding: string } {
  const spec = paperSpec(t);
  const [paper, widthMm] = spec.layout === "receipt" ? [spec.narrow ? ("58mm" as const) : ("80mm" as const), spec.widthMm] : (["80mm", autoPrintWidth(80)] as const);
  return { paper, widthMm, width: `${widthMm}mm`, padding: "0 1mm" };
}
