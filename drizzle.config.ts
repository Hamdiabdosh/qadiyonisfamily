import { defineConfig } from "drizzle-kit";

import { resolveDatabaseUrl } from "./src/lib/database-url.server";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
