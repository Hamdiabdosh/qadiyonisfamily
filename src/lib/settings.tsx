import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  dark: boolean; toggleDark: () => void;
  fontSize: number; setFontSize: (n: number) => void;
  notifications: boolean; setNotifications: (v: boolean) => void;
};
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSizeState] = useState(16);
  const [notifications, setNotifications] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDark(localStorage.getItem("dark") === "1" || (localStorage.getItem("dark") === null && window.matchMedia("(prefers-color-scheme: dark)").matches));
    const fs = Number(localStorage.getItem("fontSize")) || 16;
    setFontSizeState(fs);
    setNotifications(localStorage.getItem("notif") === "1");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--app-font-size", `${fontSize}px`);
    localStorage.setItem("fontSize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("notif", notifications ? "1" : "0");
  }, [notifications]);

  return (
    <C.Provider value={{
      dark, toggleDark: () => setDark((d) => !d),
      fontSize, setFontSize: setFontSizeState,
      notifications, setNotifications,
    }}>{children}</C.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
