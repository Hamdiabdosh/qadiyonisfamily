/**
 * Create the default admin account (idempotent on deploy).
 * Usage: bun run db:seed-admin
 *        bun run db:seed-admin -- --reset   # force password reset
 *
 * On first create: uses ADMIN_PASSWORD env if set, else default bootstrap password.
 * If admin already exists: only ensures role + admin_email — does NOT reset password.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import pg from "postgres";

import * as schema from "../src/db/schema";
import { appSettings, userRoles, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth.server";
import { ensureDatabaseUrl, requireEnv } from "./database-url";

export const ADMIN_EMAIL = "admin@qadiyonis.raafat.site";
export const ADMIN_PHONE = "0931947040";
export const ADMIN_PASSWORD_DEFAULT = "12341235";
/** @deprecated use ADMIN_PASSWORD_DEFAULT */
export const ADMIN_PASSWORD = ADMIN_PASSWORD_DEFAULT;
export const ADMIN_NAME = "Abdulhamid Teweleda Abdosh";

function bootstrapPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || ADMIN_PASSWORD_DEFAULT;
}

export async function seedAdmin(opts?: { resetPassword?: boolean }): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = pg(url, { max: 1 });
  const db = drizzle(sql, { schema });
  const resetPassword = opts?.resetPassword === true;

  try {
    let [user] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
    let created = false;

    if (user) {
      if (resetPassword) {
        await db
          .update(users)
          .set({
            passwordHash: await hashPassword(bootstrapPassword()),
            accountStatus: "approved",
            fullName: ADMIN_NAME,
            phone: ADMIN_PHONE,
          })
          .where(eq(users.id, user.id));
        console.log("Admin user exists — password reset (--reset).");
      } else {
        if (user.accountStatus !== "approved") {
          await db.update(users).set({ accountStatus: "approved" }).where(eq(users.id, user.id));
        }
        console.log("Admin user exists — password left unchanged.");
      }
    } else {
      const passwordHash = await hashPassword(bootstrapPassword());
      [user] = await db
        .insert(users)
        .values({
          email: ADMIN_EMAIL,
          phone: ADMIN_PHONE,
          fullName: ADMIN_NAME,
          passwordHash,
          accountStatus: "approved",
        })
        .returning();
      created = true;
      console.log("✓ Created admin user");
    }

    await db
      .insert(userRoles)
      .values({ userId: user.id, role: "admin" })
      .onConflictDoNothing();

    await db
      .insert(appSettings)
      .values({ key: "admin_email", value: ADMIN_EMAIL })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: ADMIN_EMAIL } });

    console.log("✓ Admin ready");
    console.log(`  Email:     ${ADMIN_EMAIL}`);
    console.log(`  Phone:     ${ADMIN_PHONE}`);
    console.log(`  Dashboard: /admin`);
    if (created || resetPassword) {
      console.log(`  Password:  ${bootstrapPassword()} (set ADMIN_PASSWORD to override)`);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function main() {
  ensureDatabaseUrl();
  requireEnv("SESSION_SECRET");
  await seedAdmin({ resetPassword: process.argv.includes("--reset") });
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  });
}
