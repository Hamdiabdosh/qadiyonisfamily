import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { resolveDatabaseUrl } from "../lib/database-url.server";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: Sql | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = resolveDatabaseUrl();
    client = postgres(url, { max: 10 });
    db = drizzle(client, { schema });
  }
  return db;
}
