// Dish photos: stored like the logo, served through our own routes.

type WithPhoto = { id: string; imagePath: string | null; updatedAt: Date | string };

/** Adds the photo URL for the restaurant's own screens. */
export function withPhoto<T extends WithPhoto>(item: T) {
  return { ...item, imageUrl: item.imagePath ? `/api/menu/items/${item.id}/photo?v=${new Date(item.updatedAt).getTime()}` : null };
}

/** The photo URL for pages guests open without signing in (QR / online menu). */
export function publicPhotoUrl(slug: string, item: WithPhoto) {
  return item.imagePath ? `/api/public/photo/${slug}/${item.id}?v=${new Date(item.updatedAt).getTime()}` : null;
}

export const PHOTO_TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/png": { ext: ".png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: ".jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: ".webp", magic: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
};
