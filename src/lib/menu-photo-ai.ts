// Reads dishes off photos of a printed menu card with Claude (Anthropic API).
// Needs ANTHROPIC_API_KEY in the environment; without it the photo option explains how to switch it on.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { guessFoodType, type ImportRow } from "./menu-import";

export function menuPhotoReady() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
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

/** Sends the photos to Claude and returns the dishes it read, ready for the import preview. */
export async function readMenuPhotos(photos: PhotoInput[]): Promise<{ rows: ImportRow[]; note: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 170_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(MenuSchema) },
    messages: [
      {
        role: "user",
        content: [
          ...photos.map((p) => ({ type: "image" as const, source: { type: "base64" as const, media_type: p.mediaType, data: p.data } })),
          { type: "text" as const, text: PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The photo could not be read. Please try a clearer photo of the menu card.");
  if (response.stop_reason === "max_tokens") throw new Error("This menu is too long to read in one go. Please upload fewer pages at a time.");
  const parsed = response.parsed_output;
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
