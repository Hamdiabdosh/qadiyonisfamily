import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import { processUploadedImage } from "./image-optimize.server";

const ALLOWED_AUDIO_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
}

export function getUploadPath(filename: string): string {
  const safe = path.basename(filename);
  if (!/^[\w.-]+$/.test(safe)) {
    throw new Error("Invalid filename");
  }
  return path.join(getUploadsDir(), safe);
}

export function mimeFromFilename(filename: string): string {
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

export function extensionFromMime(mimeType: string): string {
  return ALLOWED_AUDIO_MIME[mimeType] ?? "mp3";
}

export function validateAudioMime(mimeType: string): void {
  if (!(mimeType in ALLOWED_AUDIO_MIME)) {
    throw new Error("Unsupported audio format. Use MP3, WAV, OGG, WebM, or M4A.");
  }
}

export type GuideAudioSection = "parents" | "children" | "submitter" | "register";

const GUIDE_AUDIO_BASENAMES: Record<GuideAudioSection, string> = {
  parents: "add-family-parents",
  children: "add-family-children",
  submitter: "add-family-submitter",
  register: "register-guide",
};

function decodeBase64File(fileBase64: string, maxBytes: number, emptyMessage: string): Buffer {
  const buffer = Buffer.from(fileBase64, "base64");
  if (buffer.length === 0) throw new Error(emptyMessage);
  if (buffer.length > maxBytes) throw new Error(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  return buffer;
}

export function validateImageMime(mimeType: string): string {
  const ext = ALLOWED_IMAGE_MIME[mimeType];
  if (!ext) throw new Error("Unsupported image format. Use JPEG, PNG, WebP, or GIF.");
  return ext;
}

export async function saveExploreImage(fileBase64: string, mimeType: string): Promise<string> {
  validateImageMime(mimeType);
  const buffer = decodeBase64File(fileBase64, MAX_IMAGE_BYTES, "Empty image file");
  const basename = `explore-img-${randomUUID()}`;
  const { fullFilename } = await processUploadedImage(buffer, basename);
  return fullFilename;
}

export async function saveExploreAudio(fileBase64: string, mimeType: string): Promise<string> {
  validateAudioMime(mimeType);
  const buffer = decodeBase64File(fileBase64, MAX_AUDIO_BYTES, "Empty audio file");
  const ext = extensionFromMime(mimeType);
  const filename = `explore-audio-${randomUUID()}.${ext}`;
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getUploadPath(filename), buffer);
  return filename;
}

export async function saveGuideAudio(
  section: GuideAudioSection,
  fileBase64: string,
  mimeType: string,
  currentFilename?: string | null,
): Promise<string> {
  validateAudioMime(mimeType);

  const buffer = decodeBase64File(fileBase64, MAX_AUDIO_BYTES, "Empty audio file");
  const ext = extensionFromMime(mimeType);
  const filename = `${GUIDE_AUDIO_BASENAMES[section]}.${ext}`;
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });

  if (currentFilename && currentFilename !== filename) {
    try {
      await unlink(getUploadPath(currentFilename));
    } catch {
      // ignore missing previous file
    }
  }

  await writeFile(getUploadPath(filename), buffer);
  return filename;
}

export async function deleteGuideAudio(filename: string): Promise<void> {
  try {
    await unlink(getUploadPath(filename));
  } catch {
    // ignore missing file
  }
}
