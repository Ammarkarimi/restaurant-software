// Reads dishes off photos of a printed menu card with OpenAI (vision + structured output).
// Needs OPENAI_API_KEY in the environment; OPENAI_MODEL picks the model (default gpt-5.4-mini).
// Without the key the photo option explains how to switch it on.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { guessFoodType, type ImportRow } from "./menu-import";

const MODEL = () => process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";

export function menuPhotoReady() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const MenuSchema = z.object({
  dishes: z.array(
    z.object({
      category: z.string().describe("Section heading the dish is printed under, e.g. Starters, Main Course, Beverages"),
      name: z.string().describe("Dish name exactly as printed, in English letters"),
      description: z.string().describe("Short description if printed under the name, else empty"),
      food_type: z.enum(["veg", "non_veg", "egg", "unknown"]).describe("From the green / red symbol or the dish itself; unknown if unsure"),
      prices: z
        .array(z.object({ portion: z.string().describe("Portion name like Half, Full, Small, 6 pcs; empty when the dish has one price"), price: z.number() }))
        .describe("Every price printed for the dish, in rupees"),
    })
  ),
  unreadable: z.string().describe("Anything that could not be read clearly, else empty"),
});

export interface PhotoInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string; // base64, no data: prefix
}

const PROMPT = `These are photos of one restaurant's printed menu card (several photos may be different pages).
List every dish with its section, name, short description (only if printed), veg / non-veg / egg, and every printed price.
Rules:
- Keep dish and section names as printed, but in normal Title Case (not ALL CAPS). Translate nothing; write Hindi or regional names in English letters as printed in English if both are shown.
- If a dish has two or more prices (Half / Full, Small / Large, 6 pcs / 12 pcs, Glass / Bottle), give each as a portion. If the columns are labelled at the top of the section, use those labels.
- Prices are numbers only, in rupees, without the ₹ sign. Skip "MRP", "market price" or "seasonal" prices you cannot read as a number, and say so in "unreadable".
- Use the green dot / red dot symbols for veg / non-veg when shown; otherwise decide from the dish (chicken, mutton, fish, prawns, keema = non_veg; egg dishes = egg); use unknown only if you really cannot tell.
- Do not add dishes that are not on the photos. Do not include taxes, notes, phone numbers or headings that are not dishes.`;

/** Sends the photos to OpenAI and returns the dishes it read, ready for the import preview. */
export async function readMenuPhotos(photos: PhotoInput[]): Promise<{ rows: ImportRow[]; note: string }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 170_000, maxRetries: 1 });
  const model = MODEL();
  const response = await client.responses.parse({
    model,
    max_output_tokens: 16000,
    // Reading a menu is simple extraction: little thinking needed (only reasoning models take this).
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
    text: { format: zodTextFormat(MenuSchema, "menu") },
  });
  if (response.status === "incomplete") {
    throw new Error(response.incomplete_details?.reason === "max_output_tokens" ? "This menu is too long to read in one go. Please upload fewer pages at a time." : "The menu could not be read from these photos. Please try clearer photos.");
  }
  const refused = response.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
  if (refused) throw new Error("The photo could not be read. Please try a clearer photo of the menu card.");
  const parsed = response.output_parsed;
  if (!parsed) throw new Error("The menu could not be read from these photos. Please try clearer photos.");

  const rows: ImportRow[] = [];
  for (const d of parsed.dishes) {
    const prices = d.prices.filter((p) => Number.isFinite(p.price) && p.price > 0);
    const name = d.name.trim();
    if (!name || !prices.length) continue;
    const variants = prices.length > 1 ? prices.map((p, i) => ({ name: (p.portion.trim() || `Option ${i + 1}`).slice(0, 40), price: p.price })) : undefined;
    rows.push({
      name: name.slice(0, 120),
      category: (d.category.trim() || "Menu").slice(0, 60),
      description: d.description.trim() ? d.description.trim().slice(0, 500) : undefined,
      foodType: d.food_type === "unknown" ? guessFoodType(name) : d.food_type,
      price: Math.min(...prices.map((p) => p.price)),
      variants,
    });
  }
  return { rows, note: parsed.unreadable.trim() };
}
