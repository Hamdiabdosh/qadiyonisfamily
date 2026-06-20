import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { registerAppServiceWorker } from "@/lib/push-client";
import { detectPwaPlatform, readPwaInstalled, type PwaPlatform } from "@/lib/pwa-platform";

const STORAGE_FIRST_VISIT = "pwa_install_first_visit";
const STORAGE_POPUP_DISMISSED = "pwa_install_popup_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readPopupDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_POPUP_DISMISSED) === "1";
}

function readFirstVisit(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_FIRST_VISIT) !== "1";
}

type PwaInstallCtx = {
  isInstalled: boolean;
  canShowInstall: boolean;
  hasNativePrompt: boolean;
  platform: PwaPlatform;
  isIos: boolean;
  isAndroid: boolean;
  showInstallPopup: boolean;
  promptInstall: () => Promise<void>;
  openInstallPopup: () => void;
  closeInstallPopup: () => void;
  dismissInstallPopup: () => void;
};

const PwaInstallCtx = createContext<PwaInstallCtx | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [isInstalled, setIsInstalled] = useState(readPwaInstalled);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(readPopupDismissed);
  const [platform] = useState<PwaPlatform>(() => detectPwaPlatform());
  const isIos = platform === "ios";
  const isAndroid = platform === "android";

  useEffect(() => {
    void registerAppServiceWorker();
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPopup(false);
    };
    const onDisplayMode = () => setIsInstalled(readPwaInstalled());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    const fullscreenMq = window.matchMedia("(display-mode: fullscreen)");
    standaloneMq.addEventListener("change", onDisplayMode);
    fullscreenMq.addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      standaloneMq.removeEventListener("change", onDisplayMode);
      fullscreenMq.removeEventListener("change", onDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (isInstalled || popupDismissed) {
      setShowInstallPopup(false);
      return;
    }
    if (!readFirstVisit()) return;

    localStorage.setItem(STORAGE_FIRST_VISIT, "1");
    const timer = window.setTimeout(() => setShowInstallPopup(true), 600);
    return () => window.clearTimeout(timer);
  }, [isInstalled, popupDismissed]);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt && isAndroid) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPopup(false);
      return;
    }
    setShowInstallPopup(true);
  }, [deferredPrompt, isAndroid]);

  const openInstallPopup = useCallback(() => setShowInstallPopup(true), []);

  const closeInstallPopup = useCallback(() => setShowInstallPopup(false), []);

  const dismissInstallPopup = useCallback(() => {
    localStorage.setItem(STORAGE_POPUP_DISMISSED, "1");
    setPopupDismissed(true);
    setShowInstallPopup(false);
  }, []);

  const canShowInstall = !isInstalled;
  const hasNativePrompt = !!deferredPrompt && isAndroid;

  const value = useMemo(
    () => ({
      isInstalled,
      canShowInstall,
      hasNativePrompt,
      platform,
      isIos,
      isAndroid,
      showInstallPopup,
      promptInstall,
      openInstallPopup,
      closeInstallPopup,
      dismissInstallPopup,
    }),
    [
      isInstalled,
      canShowInstall,
      hasNativePrompt,
      platform,
      isIos,
      isAndroid,
      showInstallPopup,
      promptInstall,
      openInstallPopup,
      closeInstallPopup,
      dismissInstallPopup,
    ],
  );

  return <PwaInstallCtx.Provider value={value}>{children}</PwaInstallCtx.Provider>;
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallCtx);
  if (!ctx) throw new Error("usePwaInstall outside PwaInstallProvider");
  return ctx;
}
