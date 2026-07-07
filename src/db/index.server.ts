import { createRequire } from "node:module";

import { resolveDatabaseUrl } from "@/lib/database-url.server";
import * as schema from "./schema";

const require = createRequire(import.meta.url);

type Sql = ReturnType<typeof import("postgres").default>;
type Db = ReturnType<typeof import("drizzle-orm/postgres-js").drizzle<typeof schema>>;

let client: Sql | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = resolveDatabaseUrl();
    const postgres = require("postgres") as typeof import("postgres").default;
    const { drizzle } = require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    client = postgres(url, { max: 10 });
    db = drizzle(client, { schema });
  }
  return db;
}
