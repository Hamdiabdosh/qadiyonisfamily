/** Prefer DATABASE_URL; ignore placeholders and build from POSTGRES_* instead. */
export function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured && !isPlaceholderDatabaseUrl(configured)) {
    return configured;
  }

  if (configured && isPlaceholderDatabaseUrl(configured)) {
    console.warn("Ignoring placeholder DATABASE_URL — using POSTGRES_* variables instead.");
  }

  const host = process.env.POSTGRES_HOST?.trim() || process.env.PGHOST?.trim() || "postgres";
  const port = process.env.POSTGRES_PORT?.trim() || process.env.PGPORT?.trim() || "5432";
  const user = process.env.POSTGRES_USER?.trim() || process.env.PGUSER?.trim() || "app";
  const password = process.env.POSTGRES_PASSWORD?.trim() || process.env.PGPASSWORD?.trim();
  const database = process.env.POSTGRES_DB?.trim() || process.env.PGDATABASE?.trim() || "qadiyonis";

  if (!password) {
    console.error(
      [
        "Database is not configured.",
        "",
        "Coolify (recommended): deploy with Docker Compose using docker-compose.yml in this repo.",
        "Set only POSTGRES_PASSWORD, SESSION_SECRET, VITE_APP_URL, and LLM_API_KEY.",
        "Remove DATABASE_URL if it contains change_me_postgres_host.",
        "",
        "Or link a Coolify Postgres service and set:",
        "  POSTGRES_HOST=<internal hostname from Postgres service>",
        "  POSTGRES_PASSWORD=<password>",
        "  POSTGRES_USER=<user, often postgres>",
        "  POSTGRES_DB=<database name>",
      ].join("\n"),
    );
    process.exit(1);
  }

  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  console.log(`Resolved database URL for host "${host}".`);
  return url;
}

export function dbHost(url: string): string {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

export function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    if (parsed.password) parsed.password = "****";
    return parsed.toString().replace(/^http:/, "postgresql:");
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function isPlaceholderHost(host: string): boolean {
  const value = host.toLowerCase();
  return (
    value.includes("change_me") ||
    value.includes("placeholder") ||
    value === "localhost" ||
    value === "127.0.0.1"
  );
}

function isPlaceholderDatabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return true;
  return isPlaceholderHost(dbHost(url));
}

/** Ensure DATABASE_URL is set (for scripts spawned as child processes). */
export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

/** Environment for child processes — always includes a resolved DATABASE_URL. */
export function childEnv(databaseUrl?: string): NodeJS.ProcessEnv {
  const url = databaseUrl ?? ensureDatabaseUrl();
  return { ...process.env, DATABASE_URL: url };
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}
