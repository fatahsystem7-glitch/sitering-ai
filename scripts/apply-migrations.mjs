import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    ""
  ).trim();
}

const connectionString = databaseUrl();
if (!connectionString) {
  console.warn(
    "[migrate] No DATABASE_URL. Skipping schema apply. Set it so builds run supabase/migrations without the SQL editor.",
  );
  process.exit(0);
}

const pg = await import("pg");
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
const client = new pg.default.Client({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const seen = await client.query(
      "select 1 from public.schema_migrations where version = $1",
      [version],
    );
    if (seen.rowCount) {
      console.log(`[migrate] ${version} already applied`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`[migrate] applying ${version}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (version) values ($1) on conflict (version) do nothing",
        [version],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  console.log("[migrate] schema is up to date");
} finally {
  await client.end();
}
