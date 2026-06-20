export type MediaSize = "thumb" | "card" | "full";

const WIDTH: Record<MediaSize, number | undefined> = {
  thumb: 480,
  card: 800,
  full: undefined,
};

const QUALITY: Record<MediaSize, number> = {
  thumb: 72,
  card: 78,
  full: 82,
};

export function resolveMediaUrl(
  url: string | null | undefined,
  size: MediaSize = "full",
): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  let base: string;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    base = value;
  } else {
    base = `/uploads/${value}`;
  }

  const width = WIDTH[size];
  if (!width || !base.startsWith("/uploads/")) return base;

  const q = QUALITY[size];
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}w=${width}&q=${q}`;
}
