export type PwaPlatform = "ios" | "android" | "other";

export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function readPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
  return false;
}
