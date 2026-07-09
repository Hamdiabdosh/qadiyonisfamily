import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  getSessionFn,
  linkMyMemberFn,
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
  linkMember: (memberId?: number) => Promise<{ error: string | null; memberId: number | null }>;
  setLinkedMemberId: (memberId: number | null) => void;
  refreshSession: () => Promise<void>;
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
      .catch(() => {
        // ponytail: dev server down or offline — treat as signed out
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (identifier: string, password: string) => {
    try {
      const result = await loginFn({ data: { identifier, password } });
      if (result.error || !result.token || !result.user) {
        return { error: result.error ?? "Invalid credentials" };
      }
      localStorage.setItem(TOKEN_COOKIE, result.token);
      setUser(result.user);
      setIsAdmin(result.isAdmin);
      return { error: null };
    } catch {
      return { error: "Could not reach the server. Check that the app is running and try again." };
    }
  };

  const register = async (fullName: string, phone: string, password: string) => {
    try {
      const result = await registerFn({ data: { fullName, phone, password } });
      if (!result.ok) return { error: result.error ?? "Registration failed" };
      return { error: null };
    } catch {
      return { error: "Could not reach the server. Check that the app is running and try again." };
    }
  };

  const linkMember = async (memberId?: number) => {
    try {
      const result = await linkMyMemberFn({ data: memberId != null ? { memberId } : undefined });
      if (!result.ok) return { error: "Unable to link profile.", memberId: null };
      setUser((prev) => (prev ? { ...prev, memberId: result.linkedMemberId ?? null } : prev));
      return { error: null, memberId: result.linkedMemberId ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to link profile.", memberId: null };
    }
  };

  const setLinkedMemberId = (memberId: number | null) => {
    setUser((prev) => (prev ? { ...prev, memberId } : prev));
  };

  const refreshSession = async () => {
    const { user: u, isAdmin: admin } = await loadSession();
    setUser(u);
    setIsAdmin(admin);
  };

  const signOut = async () => {
    localStorage.removeItem(TOKEN_COOKIE);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthCtx.Provider
      value={{ user, isAdmin, loading, signIn, register, linkMember, setLinkedMemberId, refreshSession, signOut }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
