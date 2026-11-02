import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { fail, withAdmin } from "@/lib/api";
import { menuPhotoReady, readMenuPhotos } from "@/lib/menu-photo-ai";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 180;

const schema = z.object({
  photos: z
    .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(100).max(3_000_000) }))
    .min(1, "Add a photo of the menu card")
    .max(4, "Add at most 4 photos at a time"),
});

export async function GET() {
  return withAdmin(async () => NextResponse.json({ ready: menuPhotoReady() }));
}

/** Reads dishes off menu card photos. Nothing is saved: the owner checks the list, then adds it. */
export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    if (!menuPhotoReady()) fail("Reading menus from photos is not switched on yet. Ask your software provider to add the AI key (ANTHROPIC_API_KEY).", 503);
    if (!rateLimit(`menu-photo:${user.restaurantId}`, 20, 60 * 60_000)) fail("Too many photos this hour. Please try again later.", 429);
    const body = schema.parse(await request.json());
    try {
      const result = await readMenuPhotos(body.photos);
      if (!result.rows.length) fail("No dishes with prices were found in these photos. Please try a clearer, straight photo of the menu card.");
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error("Menu photo AI error", error.status, error.message);
        if (error.status === 429 || (error.status ?? 0) >= 500) fail("The menu reader is busy. Please try again in a minute.", 503);
        fail("The menu reader could not read these photos. Please try again with clearer photos.", 502);
      }
      throw error;
    }
  });
}
