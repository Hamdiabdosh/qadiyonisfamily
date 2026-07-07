/**
 * Push schema and seed initial data (lineage + admin user).
 * Usage: bun run scripts/setup-db.ts
 */
import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";

import { getDb } from "../src/db/index.server";
import {
  appSettings,
  familyMembers,
} from "../src/db/schema";
import { childEnv, ensureDatabaseUrl, requireEnv } from "./database-url";
import { runLegacyMigrations } from "./migrate-schema";
import { seedAdmin } from "./seed-admin";

async function seedLineage() {
  const db = getDb();
  const existing = await db.select({ id: familyMembers.id }).from(familyMembers).limit(1);
  if (existing.length > 0) {
    console.log("Lineage data already exists — skipping seed.");
    return;
  }

  const [root] = await db
    .insert(familyMembers)
    .values({
      fullName: "Qadi Yonis",
      gender: "male",
      isAlive: false,
      isRoot: true,
      isApproved: true,
      isInKin: true,
      generationLevel: 1,
      lineagePathFather: "Qadi Yonis",
      lineagePathMother: "Qadi Yonis",
      currentLocation: "Ethiopia",
      submittedBy: "System",
    })
    .returning();

  const insertChild = async (
    name: string,
    gender: "male" | "female",
    parentId: number,
    parentField: "fatherId" | "motherId",
    extra?: Partial<typeof familyMembers.$inferInsert>,
  ) => {
    const parent = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, parentId))
      .limit(1)
      .then((r) => r[0]);

    const lineagePath =
      parent?.isInKin && parent.lineagePathFather !== "No path"
        ? `${parent.lineagePathFather} > ${name}`
        : "No path";

    const [row] = await db
      .insert(familyMembers)
      .values({
        fullName: name,
        gender,
        [parentField]: parentId,
        isAlive: extra?.isAlive ?? false,
        isApproved: true,
        isInKin: parent?.isInKin ?? false,
        generationLevel: (parent?.generationLevel ?? 0) + 1,
        lineagePathFather: gender === "male" ? lineagePath : "No path",
        lineagePathMother: gender === "female" ? lineagePath : "No path",
        submittedBy: "System",
        ...extra,
      })
      .returning();
    return row;
  };

  const ahmed = await insertChild("Ahmed", "male", root.id, "fatherId");
  const abdosh = await insertChild("Abdosh", "male", ahmed.id, "fatherId");
  const teweleda = await insertChild("Teweleda", "male", abdosh.id, "fatherId");
  await insertChild("Abdulhamid", "male", teweleda.id, "fatherId", {
    isAlive: true,
    currentLocation: "Ethiopia",
  });

  await db
    .insert(appSettings)
    .values([
      { key: "admin_email", value: "admin@qadiyonis.space" },
      {
        key: "contact_admins",
        value:
          '[{"phone":"0931947040","telegram":"hamdiabdosh43"}]',
      },
      {
        key: "kin_page_config",
        value:
          '{"pageTitle":"","pageDescription":"","defaultTab":"lineage","showSearch":true,"showFilters":true,"showLineageTab":true,"showLocationTab":true,"showGenerationTab":true}',
      },
    ])
    .onConflictDoNothing();

  console.log("✓ Seeded lineage data");
}

function pushSchema(env: NodeJS.ProcessEnv): void {
  console.log("Pushing database schema…");
  execSync("bun run db:push:force", {
    stdio: "inherit",
    env,
  });
}

export async function runDatabaseSetup(): Promise<void> {
  const databaseUrl = ensureDatabaseUrl();
  const env = childEnv(databaseUrl);
  requireEnv("SESSION_SECRET");

  pushSchema(env);
  await runLegacyMigrations();
  await seedLineage();
  await seedAdmin();
}

async function main() {
  await runDatabaseSetup();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
}
