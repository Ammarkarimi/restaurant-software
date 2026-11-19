"use client";

/** Shrinks a phone photo so a few pages fit in one upload and read faster. */
export async function shrinkPhoto(file: File): Promise<{ mediaType: "image/jpeg"; data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { mediaType: "image/jpeg", data: url.split(",")[1], preview: url };
}
