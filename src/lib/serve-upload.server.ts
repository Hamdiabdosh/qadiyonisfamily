import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  getResizedImage,
  imageMimeFromFilename,
  isImageFilename,
  thumbFilenameFor,
} from "./image-optimize.server";
import { getUploadPath } from "./uploads.server";

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_VARIANT = "public, max-age=604800";

export async function serveUploadFile(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/uploads/")) return null;

  const filename = decodeURIComponent(url.pathname.slice("/uploads/".length));
  if (!filename || filename.includes("/") || filename.includes("..") || filename.startsWith(".")) {
    return new Response("Not found", { status: 404 });
  }

  const widthParam = url.searchParams.get("w");
  const qualityParam = url.searchParams.get("q");

  if (widthParam && isImageFilename(filename)) {
    const width = Number.parseInt(widthParam, 10);
    const quality = qualityParam ? Number.parseInt(qualityParam, 10) : 75;
    if (Number.isFinite(width) && width > 0) {
      if (width <= 520) {
        const thumbName = thumbFilenameFor(filename);
        try {
          const thumbPath = getUploadPath(thumbName);
          await stat(thumbPath);
          const file = await readFile(thumbPath);
          return new Response(file, {
            headers: {
              "content-type": "image/webp",
              "cache-control": CACHE_IMMUTABLE,
            },
          });
        } catch {
          // fall through to on-the-fly resize
        }
      }

      const resized = await getResizedImage(filename, width, quality);
      if (resized) {
        return new Response(resized.buffer, {
          headers: {
            "content-type": resized.contentType,
            "cache-control": CACHE_VARIANT,
          },
        });
      }
    }
  }

  try {
    const filePath = getUploadPath(filename);
    await stat(filePath);
    const file = await readFile(filePath);
    const isImage = isImageFilename(filename);
    return new Response(file, {
      headers: {
        "content-type": isImage ? imageMimeFromFilename(filename) : mimeFromFilename(filename),
        "cache-control": isImage ? CACHE_IMMUTABLE : "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function mimeFromFilename(filename: string): string {
  if (isImageFilename(filename)) return imageMimeFromFilename(filename);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    m4a: "audio/mp4",
  };
  return map[ext] ?? "application/octet-stream";
}
