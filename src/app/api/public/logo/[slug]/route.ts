import { NextRequest, NextResponse } from "next/server";
import { rawPrisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** A restaurant's logo for pages guests open without signing in (QR menu, e-bill). It is printed on every bill anyway. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await rawPrisma.restaurant.findUnique({ where: { slug }, select: { status: true, settings: { select: { logoPath: true } } } });
  const logoPath = restaurant?.status === "active" ? restaurant.settings?.logoPath : null;
  if (!logoPath) return NextResponse.json({ error: "No logo" }, { status: 404 });
  try {
    const { buffer, contentType } = await readStoredFile(logoPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": IMAGE_TYPES.has(contentType) ? contentType : "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "No logo" }, { status: 404 });
  }
}
