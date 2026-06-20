import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { getUploadPath, getUploadsDir } from "./uploads.server";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export function isImageFilename(filename: string): boolean {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return IMAGE_EXT.has(ext);
}

export function imageMimeFromFilename(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

function variantCachePath(sourceFilename: string, width: number, quality: number): string {
  const hash = createHash("sha256").update(`${sourceFilename}:${width}:${quality}`).digest("hex").slice(0, 16);
  return path.join(getUploadsDir(), ".variants", `${hash}.webp`);
}

export type ProcessedImage = {
  fullFilename: string;
  fullBuffer: Buffer;
  thumbBuffer: Buffer;
};

/** Compress on upload: WebP full (max 1400px) + 480px thumb saved beside original name pattern. */
export async function processUploadedImage(buffer: Buffer, basename: string): Promise<ProcessedImage> {
  const fullFilename = `${basename}.webp`;
  const thumbFilename = `${basename}-480.webp`;

  const fullBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();

  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fullFilename), fullBuffer);
  await writeFile(path.join(dir, thumbFilename), thumbBuffer);

  return { fullFilename, fullBuffer, thumbBuffer };
}

export function thumbFilenameFor(fullFilename: string): string {
  const parsed = path.parse(fullFilename);
  return `${parsed.name}-480${parsed.ext || ".webp"}`;
}

export async function getResizedImage(
  filename: string,
  width: number,
  quality: number,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isImageFilename(filename)) return null;

  const safeWidth = Math.min(2000, Math.max(64, Math.round(width)));
  const safeQuality = Math.min(90, Math.max(40, Math.round(quality)));

  const cachePath = variantCachePath(filename, safeWidth, safeQuality);
  try {
    const cached = await readFile(cachePath);
    return { buffer: cached, contentType: "image/webp" };
  } catch {
    // generate below
  }

  let sourcePath: string;
  try {
    sourcePath = getUploadPath(filename);
    await stat(sourcePath);
  } catch {
    return null;
  }

  const buffer = await sharp(sourcePath)
    .rotate()
    .resize({ width: safeWidth, height: safeWidth, fit: "inside", withoutEnlargement: true })
    .webp({ quality: safeQuality, effort: 4 })
    .toBuffer();

  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, buffer).catch(() => undefined);

  return { buffer, contentType: "image/webp" };
}
