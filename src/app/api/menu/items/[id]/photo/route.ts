import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, withAdmin, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { PHOTO_TYPES, withPhoto } from "@/lib/menu-photos";
import { deleteStoredFile, readStoredFile, storeFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };
const MAX_BYTES = 3 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: Params) {
  return withAuth(async () => {
    const { id } = await params;
    const item = await prisma.menuItem.findFirst({ where: { id }, select: { imagePath: true } });
    if (!item?.imagePath) fail("No photo", 404);
    try {
      const { buffer, contentType } = await readStoredFile(item.imagePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": PHOTO_TYPES[contentType] ? contentType : "application/octet-stream",
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      fail("Photo not found", 404);
    }
  }, { kitchen: true });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const item = await prisma.menuItem.findFirst({ where: { id } });
    if (!item) fail("Menu item not found", 404);
    const form = await request.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File) || file.size === 0) fail("Please choose a photo");
    if (file.size > MAX_BYTES) fail("The photo must be smaller than 3 MB");
    const type = PHOTO_TYPES[file.type];
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!type || !type.magic(head)) fail("Please upload a PNG, JPG or WebP photo");
    const stored = await storeFile(new File([await file.arrayBuffer()], `dish${type.ext}`, { type: file.type }), `dishes/${item.restaurantId}`);
    const updated = await prisma.menuItem.update({ where: { id }, data: { imagePath: stored.filePath } });
    if (item.imagePath) await deleteStoredFile(item.imagePath).catch(() => null);
    await logActivity(user, "Added dish photo", item.name);
    return NextResponse.json({ item: withPhoto(updated) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAdmin(async (user) => {
    const { id } = await params;
    const item = await prisma.menuItem.findFirst({ where: { id } });
    if (!item) fail("Menu item not found", 404);
    if (item.imagePath) await deleteStoredFile(item.imagePath).catch(() => null);
    const updated = await prisma.menuItem.update({ where: { id }, data: { imagePath: null } });
    await logActivity(user, "Removed dish photo", item.name);
    return NextResponse.json({ item: withPhoto(updated) });
  });
}
