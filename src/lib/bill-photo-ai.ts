// Reads a supplier's bill (tax invoice, kacha bill, delivery challan) from photos with OpenAI, so
// the owner doesn't type every line into a purchase. Same key and model as the menu photo reader.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v4";

const MODEL = () => process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";

const BillSchema = z.object({
  supplier_name: z.string().describe("Seller's business name as printed at the top, else empty"),
  supplier_phone: z.string().describe("Seller's phone number, else empty"),
  supplier_gstin: z.string().describe("Seller's 15-character GSTIN, else empty"),
  invoice_no: z.string().describe("Bill / invoice number, else empty"),
  invoice_date: z.string().describe("Bill date as YYYY-MM-DD, else empty"),
  lines: z.array(
    z.object({
      name: z.string().describe("Item name as printed, in English letters, normal Title Case"),
      quantity: z.number().describe("Quantity bought"),
      unit: z.string().describe("Unit as printed: kg, g, L, ml, pcs, dozen, pack, box, bottle; empty if not printed"),
      rate: z.number().describe("Price per unit before tax, in rupees; 0 if not printed"),
      amount: z.number().describe("Line amount in rupees as printed; 0 if not printed"),
    })
  ),
  tax_total: z.number().describe("Total GST / tax on the bill in rupees, 0 if none"),
  grand_total: z.number().describe("Final bill total in rupees, 0 if not printed"),
  unreadable: z.string().describe("Anything that could not be read clearly, else empty"),
});

export type ReadBill = z.infer<typeof BillSchema>;

const PROMPT = `These are photos of one bill from a supplier to a restaurant (vegetables, meat, dairy, groceries, gas, packaging…). It may be printed or handwritten, in English or with Hindi words.
Read the seller's details and every item line.
Rules:
- One entry per item line. Skip lines that are only totals, taxes, discounts, transport or round off.
- Quantity and rate are numbers only. If only the line amount is printed, give the amount and rate 0. If the rate includes GST, still give it as printed.
- Write item names in English letters as printed (e.g. "Pyaz" stays "Pyaz", "Onion" stays "Onion"). Do not invent items.
- Dates as YYYY-MM-DD. Leave a field empty or 0 when it is not on the bill.`;

export async function readSupplierBill(photos: Array<{ mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }>): Promise<ReadBill> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 1 });
  const model = MODEL();
  const response = await client.responses.parse({
    model,
    max_output_tokens: 8000,
    ...(/^(gpt-5|o\d)/.test(model) && { reasoning: { effort: "low" as const } }),
    input: [
      {
        role: "user",
        content: [
          ...photos.map((p) => ({ type: "input_image" as const, image_url: `data:${p.mediaType};base64,${p.data}`, detail: "high" as const })),
          { type: "input_text" as const, text: PROMPT },
        ],
      },
    ],
    text: { format: zodTextFormat(BillSchema, "supplier_bill") },
  });
  const refused = response.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
  if (response.status === "incomplete" || refused || !response.output_parsed) throw new Error("The bill could not be read from this photo. Please try a clearer, straight photo.");
  return response.output_parsed;
}
