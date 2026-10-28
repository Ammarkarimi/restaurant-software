import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { PHOTO_TYPES } from "@/lib/menu-photos";
import { readStoredFile } from "@/lib/storage";

/** A dish photo for the QR / online menu. Only dishes shown to guests, of active restaurants. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  const item = await rawPrisma.menuItem.findFirst({
    where: { id: itemId, showOnline: true, restaurant: { slug, status: "active" } },
    select: { imagePath: true },
  });
  if (!item?.imagePath) return NextResponse.json({ error: "No photo" }, { status: 404 });
  try {
    const { buffer, contentType } = await readStoredFile(item.imagePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": PHOTO_TYPES[contentType] ? contentType : "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
}
