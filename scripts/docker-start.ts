/**
 * Production container entrypoint: wait for Postgres, migrate/seed, start server.
 */
import { execSync } from "node:child_process";
import postgres from "postgres";

import { childEnv, dbHost, ensureDatabaseUrl, maskDatabaseUrl, requireEnv } from "./database-url";
import { runDatabaseSetup } from "./setup-db";

async function waitForDatabase(url: string, attempts = 30, delayMs = 2000): Promise<void> {
  const host = dbHost(url);
  console.log(`Connecting to database host "${host}"…`);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let sql: ReturnType<typeof postgres> | undefined;
    try {
      sql = postgres(url, { max: 1, connect_timeout: 5 });
      await sql`SELECT 1`;
      console.log("Database is reachable.");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Database not ready (${attempt}/${attempts}): ${message}`);
      if (attempt === attempts) {
        console.error(
          [
            "Could not connect to Postgres after multiple attempts.",
            `Host: ${host}`,
            `DATABASE_URL: ${maskDatabaseUrl(url)}`,
            "If using Coolify Dockerfile deploy: switch to Docker Compose, or set POSTGRES_HOST to your linked Postgres internal hostname.",
          ].join("\n"),
        );
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      await sql?.end({ timeout: 1 }).catch(() => undefined);
    }
  }
}

async function main() {
  const databaseUrl = ensureDatabaseUrl();
  requireEnv("SESSION_SECRET");

  const llmConfigured = Boolean(process.env.LLM_API_KEY?.trim());
  console.log(`LLM assistant: ${llmConfigured ? "configured" : "NOT configured (set LLM_API_KEY)"}`);

  await waitForDatabase(databaseUrl);

  await runDatabaseSetup();

  const env = childEnv(databaseUrl);
  console.log("Starting web server…");
  execSync("bun .output/server/index.mjs", { stdio: "inherit", env });
}

main().catch((error) => {
  console.error("Startup failed:", error);
  process.exit(1);
});
