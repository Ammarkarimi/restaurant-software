import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put, head } from "@vercel/blob";

export type StoredFile = {
  fileName: string;
  filePath: string;
  mimeType: string;
};

type StorageDriver = "local" | "blob";

function getStorageDriver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER?.toLowerCase();
  if (configured === "local" || configured === "blob") {
    return configured;
  }
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

function getLocalUploadDir(): string {
  return path.join(process.cwd(), process.env.UPLOAD_DIR || "./uploads");
}

function buildRelativePath(subfolder: string, uniqueName: string): string {
  return path.join(subfolder, uniqueName).replace(/\\/g, "/");
}

export async function storeFile(
  file: File,
  subfolder: string
): Promise<StoredFile> {
  const ext = path.extname(file.name) || "";
  const uniqueName = `${randomUUID()}${ext}`;
  const relativePath = buildRelativePath(subfolder, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (getStorageDriver() === "blob") {
    const blob = await put(relativePath, buffer, {
      access: "public",
      contentType: file.type || undefined,
      addRandomSuffix: false,
    });

    return {
      fileName: file.name,
      filePath: blob.pathname,
      mimeType: file.type || "application/octet-stream",
    };
  }

  const uploadPath = path.join(getLocalUploadDir(), subfolder);
  await mkdir(uploadPath, { recursive: true });
  await writeFile(path.join(uploadPath, uniqueName), buffer);

  return {
    fileName: file.name,
    filePath: relativePath,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function readStoredFile(
  filePath: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const sanitized = filePath.replace(/\.\./g, "").replace(/\\/g, "/");

  if (getStorageDriver() === "blob") {
    const blobMeta = await head(sanitized);
    const response = await fetch(blobMeta.url);
    if (!response.ok) {
      throw new Error("File not found");
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: blobMeta.contentType || "application/octet-stream",
    };
  }

  const fullPath = path.join(getLocalUploadDir(), sanitized);
  const buffer = await readFile(fullPath);
  const ext = path.extname(sanitized).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return {
    buffer,
    contentType: mimeTypes[ext] || "application/octet-stream",
  };
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  const sanitized = filePath.replace(/\.\./g, "").replace(/\\/g, "/");

  if (getStorageDriver() === "blob") {
    const { del } = await import("@vercel/blob");
    await del(sanitized);
    return;
  }

  const { unlink } = await import("fs/promises");
  await unlink(path.join(getLocalUploadDir(), sanitized));
}

export function getUploadDir(): string {
  return getLocalUploadDir();
}
