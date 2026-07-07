/** Public site URL — set VITE_APP_URL at build time (Docker/Coolify). */
const raw = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
export const APP_URL = (raw || "https://qadiyonis.raafat.site").replace(/\/$/, "");
