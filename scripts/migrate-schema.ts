/**
 * Applies legacy schema patches after drizzle-kit push (safe to re-run).
 * Usage: bun run scripts/migrate-schema.ts
 */
import type postgres from "postgres";
import pg from "postgres";

import { ensureDatabaseUrl } from "./database-url";

type Sql = ReturnType<typeof pg>;

async function tableExists(sql: Sql, table: string): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) AS exists
  `;
  return row?.exists === true;
}

async function runStatement(sql: Sql, label: string, statement: string): Promise<void> {
  try {
    await sql.unsafe(statement);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("already exists") ||
      message.includes("duplicate") ||
      message.includes("does not exist")
    ) {
      console.log(`  · ${label} (skipped — already applied or not needed)`);
      return;
    }
    throw error;
  }
}

export async function runLegacyMigrations(existingSql?: Sql): Promise<void> {
  const databaseUrl = ensureDatabaseUrl();
  const sql = existingSql ?? pg(databaseUrl);
  const ownsConnection = !existingSql;

  console.log("Running legacy schema patches…");

  await runStatement(
    sql,
    "account_status enum",
    `
    DO $$ BEGIN
      CREATE TYPE account_status AS ENUM('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `,
  );

  if (!(await tableExists(sql, "users"))) {
    console.log("  · users table not found — skipping legacy user patches (drizzle push handles fresh DBs)");
  } else {
    await runStatement(sql, "users.phone", `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`);
    await runStatement(sql, "users.full_name", `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text`);
    await runStatement(
      sql,
      "users.account_status",
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'approved'`,
    );
    await runStatement(sql, "users.email nullable", `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
    await runStatement(
      sql,
      "users_phone_unique index",
      `CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL`,
    );
    await runStatement(
      sql,
      "admin email domain",
      `UPDATE users SET email = 'admin@qadiyonis.space' WHERE email = 'admin@qadiyonis.site'`,
    );
    await runStatement(
      sql,
      "admin profile",
      `UPDATE users SET account_status = 'approved', full_name = COALESCE(full_name, 'Admin')
       WHERE email = 'admin@qadiyonis.space'`,
    );
  }

  if (await tableExists(sql, "app_settings")) {
    await runStatement(
      sql,
      "admin_email setting",
      `UPDATE app_settings SET value = 'admin@qadiyonis.space'
       WHERE key = 'admin_email' AND value = 'admin@qadiyonis.site'`,
    );
  }

  await runStatement(
    sql,
    "explore_posts table",
    `
    CREATE TABLE IF NOT EXISTS explore_posts (
      id bigserial PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      image_url text,
      category text NOT NULL DEFAULT 'story',
      share_with_kin boolean NOT NULL DEFAULT true,
      is_published boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      published_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  );

  await runStatement(
    sql,
    "explore_gallery table",
    `
    CREATE TABLE IF NOT EXISTS explore_gallery (
      id bigserial PRIMARY KEY,
      image_url text NOT NULL,
      caption text,
      share_with_kin boolean NOT NULL DEFAULT true,
      is_published boolean NOT NULL DEFAULT true,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  );

  if (await tableExists(sql, "family_members")) {
    await runStatement(
      sql,
      "family_members.birth_order",
      `ALTER TABLE family_members ADD COLUMN IF NOT EXISTS birth_order integer`,
    );
    await runStatement(
      sql,
      "family_members.submission_id",
      `ALTER TABLE family_members ADD COLUMN IF NOT EXISTS submission_id uuid`,
    );
  }

  await runStatement(
    sql,
    "family_submission_status enum",
    `
    DO $$ BEGIN
      CREATE TYPE family_submission_status AS ENUM('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `,
  );

  await runStatement(
    sql,
    "family_submissions table",
    `
    CREATE TABLE IF NOT EXISTS family_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submitted_by_user uuid REFERENCES users(id) ON DELETE SET NULL,
      form_data text NOT NULL,
      member_ids text NOT NULL,
      status family_submission_status NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  );

  await runStatement(
    sql,
    "translations table",
    `
    CREATE TABLE IF NOT EXISTS translations (
      id bigserial PRIMARY KEY,
      key text NOT NULL,
      lang text NOT NULL,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (key, lang)
    )
  `,
  );

  await runStatement(
    sql,
    "push_subscriptions table",
    `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  );

  await runStatement(
    sql,
    "explore_gallery.is_featured",
    `ALTER TABLE explore_gallery ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false`,
  );

  await runStatement(
    sql,
    "explore_posts.file_link",
    `ALTER TABLE explore_posts ADD COLUMN IF NOT EXISTS file_link text`,
  );

  await runStatement(
    sql,
    "explore_posts.youtube_url",
    `ALTER TABLE explore_posts ADD COLUMN IF NOT EXISTS youtube_url text`,
  );

  await runStatement(
    sql,
    "explore_posts.audio_url",
    `ALTER TABLE explore_posts ADD COLUMN IF NOT EXISTS audio_url text`,
  );

  await runStatement(
    sql,
    "explore_social_platform enum",
    `
    DO $$ BEGIN
      CREATE TYPE explore_social_platform AS ENUM('tiktok', 'facebook', 'telegram');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `,
  );

  await runStatement(
    sql,
    "explore_social_platform.youtube",
    `
    DO $$ BEGIN
      ALTER TYPE explore_social_platform ADD VALUE 'youtube';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  );

  await runStatement(
    sql,
    "explore_social_links table",
    `
    CREATE TABLE IF NOT EXISTS explore_social_links (
      id bigserial PRIMARY KEY,
      platform explore_social_platform NOT NULL,
      account_name text NOT NULL,
      url text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_published boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  );

  if (await tableExists(sql, "app_settings")) {
    await runStatement(
      sql,
      "default contact_admins",
      `INSERT INTO app_settings (key, value) VALUES (
        'contact_admins',
        '[{"phone":"0911357612","telegram":"lahek11"},{"phone":"0961219838","telegram":"the_wadeh"}]'
      ) ON CONFLICT (key) DO NOTHING`,
    );
    await runStatement(
      sql,
      "default kin_page_config",
      `INSERT INTO app_settings (key, value) VALUES (
        'kin_page_config',
        '{"pageTitle":"","pageDescription":"","defaultTab":"lineage","showSearch":true,"showFilters":true,"showLineageTab":true,"showLocationTab":true,"showGenerationTab":true}'
      ) ON CONFLICT (key) DO NOTHING`,
    );
  }

  if (await tableExists(sql, "family_members")) {
    await runStatement(
      sql,
      "rename Sheik Feto root",
      `UPDATE family_members SET full_name = 'Qadi Yonis'
       WHERE full_name IN ('Sheik Feto', 'Ali Sheik Feto')`,
    );
    await runStatement(
      sql,
      "lineage paths Sheik Feto",
      `UPDATE family_members SET
        lineage_path_father = REPLACE(REPLACE(lineage_path_father, 'Ali Sheik Feto', 'Qadi Yonis'), 'Sheik Feto', 'Qadi Yonis'),
        lineage_path_mother = REPLACE(REPLACE(lineage_path_mother, 'Ali Sheik Feto', 'Qadi Yonis'), 'Sheik Feto', 'Qadi Yonis')`,
    );
  }

  if (await tableExists(sql, "translations")) {
    await runStatement(
      sql,
      "translations Sheik Feto",
      `UPDATE translations SET
        value = REPLACE(REPLACE(value, 'Ali Sheik Feto', 'Qadi Yonis'), 'Sheik Feto', 'Qadi Yonis')
       WHERE value LIKE '%Sheik Feto%' OR value LIKE '%Ali Sheik Feto%'`,
    );
  }

  if (ownsConnection) {
    await sql.end();
  }

  console.log("✓ Legacy schema patches complete");
}

async function main() {
  await runLegacyMigrations();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
