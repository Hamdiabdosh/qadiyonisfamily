import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/index.server";
import { notifications, userRoles, users } from "@/db/schema";
import {
  getBearerToken,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
  TOKEN_COOKIE,
} from "@/lib/auth.server";
import { requireAdmin } from "@/lib/auth-middleware.server";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
};

function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
  };
}

async function roleForUser(userId: string) {
  const db = getDb();
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return roles.some((r) => r.role === "admin") ? "admin" : "member";
}

export const registerFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(6).max(40),
      password: z.string().min(6).max(100),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const phone = data.phone.replace(/\s+/g, "");
    const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (existing) return { error: "An account with this phone number already exists.", ok: false };

    const passwordHash = await hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({
        fullName: data.fullName.trim(),
        phone,
        passwordHash,
        accountStatus: "pending",
      })
      .returning();

    await db.insert(userRoles).values({ userId: user.id, role: "member" });

    await db.insert(notifications).values({
      userId: null,
      title: "New account request",
      body: `${data.fullName.trim()} (${phone}) requested access.`,
      type: "system",
    });

    return { ok: true, error: null };
  });

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      identifier: z.string().min(1),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const identifier = data.identifier.trim();
    const isEmail = identifier.includes("@");
    const [user] = await db
      .select()
      .from(users)
      .where(isEmail ? eq(users.email, identifier.toLowerCase()) : eq(users.phone, identifier.replace(/\s+/g, "")))
      .limit(1);

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      return { error: "Invalid credentials", token: null, user: null, isAdmin: false };
    }

    if (user.accountStatus === "pending") {
      return { error: "Your account is waiting for admin approval.", token: null, user: null, isAdmin: false };
    }
    if (user.accountStatus === "rejected") {
      return { error: "Your account request was rejected.", token: null, user: null, isAdmin: false };
    }

    const isAdmin = (await roleForUser(user.id)) === "admin";
    const token = await signToken({
      sub: user.id,
      email: user.email ?? user.phone ?? user.id,
      role: isAdmin ? "admin" : "member",
    });

    return {
      error: null,
      token,
      user: toAuthUser(user),
      isAdmin,
    };
  });

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getBearerToken(getRequest());
  if (!token) return { user: null, isAdmin: false };

  const payload = await verifyToken(token);
  if (!payload) return { user: null, isAdmin: false };

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || user.accountStatus !== "approved") return { user: null, isAdmin: false };

  return {
    user: toAuthUser(user),
    isAdmin: payload.role === "admin",
  };
});

export type AdminAccountRow = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  accountStatus: "pending" | "approved" | "rejected";
  role: "admin" | "member";
  createdAt: Date;
};

export const getAccountsAdminFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminAccountRow[]> => {
    const db = getDb();
    const [allUsers, roles] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(userRoles),
    ]);

    const roleByUser = new Map<string, "admin" | "member">();
    for (const row of roles) {
      if (row.role === "admin") roleByUser.set(row.userId, "admin");
      else if (!roleByUser.has(row.userId)) roleByUser.set(row.userId, "member");
    }

    return allUsers.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      accountStatus: user.accountStatus,
      role: roleByUser.get(user.id) ?? "member",
      createdAt: user.createdAt,
    }));
  });

/** @deprecated Use getAccountsAdminFn — kept for any legacy callers */
export const getPendingAccountsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    return db.select().from(users).where(eq(users.accountStatus, "pending")).orderBy(users.createdAt);
  });

export const approveAccountFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.update(users).set({ accountStatus: "approved" }).where(eq(users.id, data.id));
    return { ok: true };
  });

export const rejectAccountFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([requireAdmin])
  .handler(async ({ data }) => {
    const db = getDb();
    await db.update(users).set({ accountStatus: "rejected" }).where(eq(users.id, data.id));
    return { ok: true };
  });

export const setUserRoleFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "member"]),
    }),
  )
  .middleware([requireAdmin])
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && data.role === "member") {
      throw new Error("You cannot remove your own admin role.");
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
    if (!user) throw new Error("User not found");
    if (user.accountStatus !== "approved") {
      throw new Error("Only approved accounts can have their role changed.");
    }

    if (data.role === "member") {
      const admins = await db.select().from(userRoles).where(eq(userRoles.role, "admin"));
      const targetIsAdmin = admins.some((r) => r.userId === data.userId);
      if (targetIsAdmin && admins.length <= 1) {
        throw new Error("Cannot demote the last admin.");
      }
    }

    await db.delete(userRoles).where(eq(userRoles.userId, data.userId));
    await db.insert(userRoles).values({ userId: data.userId, role: data.role });

    return { ok: true };
  });

export { TOKEN_COOKIE };
