import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  getSessionFn,
  loginFn,
  registerFn,
  TOKEN_COOKIE,
  type AuthUser,
} from "@/lib/api/auth.functions";

type Ctx = {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  register: (fullName: string, phone: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

async function loadSession() {
  const { user, isAdmin } = await getSessionFn();
  return { user, isAdmin };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession()
      .then(({ user: u, isAdmin: admin }) => {
        setUser(u);
        setIsAdmin(admin);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (identifier: string, password: string) => {
    const result = await loginFn({ data: { identifier, password } });
    if (result.error || !result.token || !result.user) {
      return { error: result.error ?? "Invalid credentials" };
    }
    localStorage.setItem(TOKEN_COOKIE, result.token);
    setUser(result.user);
    setIsAdmin(result.isAdmin);
    return { error: null };
  };

  const register = async (fullName: string, phone: string, password: string) => {
    const result = await registerFn({ data: { fullName, phone, password } });
    if (!result.ok) return { error: result.error ?? "Registration failed" };
    return { error: null };
  };

  const signOut = async () => {
    localStorage.removeItem(TOKEN_COOKIE);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthCtx.Provider value={{ user, isAdmin, loading, signIn, register, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
