import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getSettings, publicSettings } from "@/lib/settings";
import { deleteStoredFile, readStoredFile, storeFile } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;
// SVG is left out on purpose: it can carry scripts.
const TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/png": { ext: ".png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: ".jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: ".webp", magic: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
};

/** The restaurant's logo, for the app and printed bills. */
export async function GET() {
  return withAuth(async () => {
    const settings = await getSettings();
    if (!settings.logoPath) fail("No logo uploaded", 404);
    try {
      const { buffer, contentType } = await readStoredFile(settings.logoPath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": TYPES[contentType] ? contentType : "application/octet-stream",
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      fail("Logo not found", 404);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAdmin(async (user) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("logo");
    if (!(file instanceof File) || file.size === 0) fail("Please choose an image file");
    if (file.size > MAX_BYTES) fail("The logo must be smaller than 2 MB");
    const type = TYPES[file.type];
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!type || !type.magic(head)) fail("Please upload a PNG, JPG or WebP image");

    const settings = await getSettings();
    const stored = await storeFile(new File([await file.arrayBuffer()], `logo${type.ext}`, { type: file.type }), `logos/${settings.restaurantId}`);
    const updated = await prisma.restaurantSettings.update({ where: { id: settings.id }, data: { logoPath: stored.filePath } });
    if (settings.logoPath) await deleteStoredFile(settings.logoPath).catch(() => null);
    await logActivity(user, "Uploaded logo");
    return NextResponse.json({ settings: publicSettings(updated) });
  });
}

export async function DELETE() {
  return withAdmin(async (user) => {
    const settings = await getSettings();
    if (settings.logoPath) await deleteStoredFile(settings.logoPath).catch(() => null);
    const updated = await prisma.restaurantSettings.update({ where: { id: settings.id }, data: { logoPath: null } });
    await logActivity(user, "Removed logo");
    return NextResponse.json({ settings: publicSettings(updated) });
  });
}
