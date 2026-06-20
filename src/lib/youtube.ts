export function youtubeEmbedUrl(url: string | undefined | null) {
  if (!url?.trim()) return null;
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  if (url.includes("youtube.com/embed/")) return url;
  return null;
}
