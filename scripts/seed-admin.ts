/**
 * Create or reset the default admin account.
 * Usage: bun run db:seed-admin
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
export const ADMIN_PASSWORD = "12341235";
export const ADMIN_NAME = "Abdulhamid Teweleda Abdosh";

export async function seedAdmin(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = pg(url, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    let [user] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);

    if (user) {
      await db
        .update(users)
        .set({
          passwordHash,
          accountStatus: "approved",
          fullName: ADMIN_NAME,
          phone: ADMIN_PHONE,
        })
        .where(eq(users.id, user.id));
      console.log("Admin user exists — password and profile updated.");
    } else {
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
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Phone:    ${ADMIN_PHONE}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Dashboard: /admin`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function main() {
  ensureDatabaseUrl();
  requireEnv("SESSION_SECRET");
  await seedAdmin();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  });
}
