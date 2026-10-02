/**
 * Applies supabase/migrations/*.sql to the database, in filename order.
 *
 * Run it explicitly — `npm run db:migrate` — from your machine or a one-off
 * CI job. It is deliberately NOT part of `npm run build`: Vercel build
 * containers must never execute DDL, and their egress/SSL limits have
 * broken deployments when they did. The build only compiles the app now.
 *
 * Requires DATABASE_URL (SUPABASE_DB_URL / POSTGRES_URL are accepted as
 * aliases). For local convenience .env.local / .env are read first — values
 * already present in the real environment always win.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");

// ── .env.local support (dotenv-style, without the dependency) ──────────
function parseEnvValue(raw) {
  const quoted = /^\s*("([^"]*)"|'([^']*)')/.exec(raw);
  if (quoted) return quoted[2] ?? quoted[3] ?? "";
  // Unquoted: cut a trailing `# comment`.
  return raw.replace(/\s+#.*$/, "").trim();
}

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of (await readFile(full, "utf8")).split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue; // comments / blanks
      const [, key, raw] = match;
      if (!(key in process.env)) process.env[key] = parseEnvValue(raw);
    }
  }
}

// ── Connection handling (mirrors lib/db/postgres.ts) ───────────────────
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Rewrites the connection string to carry `sslmode=no-verify`. */
function withSslModeNoVerify(url) {
  if (/[?&]sslmode=/.test(url)) {
    return url.replace(/([?&]sslmode=)[^&]*/, "$1no-verify");
  }
  return url + (url.includes("?") ? "&" : "?") + "sslmode=no-verify";
}

function preferIpv4() {
  try {
    // Prefer the pooler's A record (IPv4 route, e.g.
    // aws-0-eu-west-2.pooler.supabase.com) over AAAA — Node ≥17 otherwise
    // resolves verbatim and IPv6-less networks stall with ENETUNREACH.
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    /* Node < 17 resolves IPv4 first by default. */
  }
}

// ── Migrate ─────────────────────────────────────────────────────────────
await loadLocalEnv();

const connectionString = (
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  ""
).trim();

if (!connectionString) {
  console.error(
    "[migrate] No DATABASE_URL set — nothing to migrate against.\n" +
      "Add it to .env.local or the environment, e.g.\n" +
      "  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:6543/postgres\n" +
      "(Migrations no longer run during `npm run build`; use `npm run db:migrate`.)",
  );
  process.exit(1);
}

const local = LOCAL_HOSTS.has(hostnameOf(connectionString));
if (!local) preferIpv4();

const pg = (await import("pg")).default;
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();

const client = new pg.Client({
  // The pooler serves a Supabase-issued certificate that is not in any trust
  // store, so SSL is always requested but not verified — matching the
  // `sslmode=no-verify` folded into the connection string.
  connectionString: local ? connectionString : withSslModeNoVerify(connectionString),
  ssl: local ? undefined : { rejectUnauthorized: false },
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
