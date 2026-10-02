import dns from "node:dns";
import { Pool, type PoolConfig } from "pg";

/**
 * Shared PostgreSQL connectivity — SERVER-ONLY (Node runtime).
 *
 * One module decides, for the whole app, how direct `pg` connections to the
 * Supabase pooler are made. Every rule below exists because a deployment
 * once failed without it:
 *
 * • TLS — remote hosts always connect with `ssl: { rejectUnauthorized: false }`.
 *   The pooler presents a Supabase-issued certificate that is not in any
 *   trust store, so strict verification rejects it. The connection string is
 *   also normalised to `?sslmode=no-verify`, which pg's own URL parser maps
 *   to the same setting — so the string stays truthful if it is ever passed
 *   to psql or migration tooling instead.
 *
 * • IPv4 — `dns.setDefaultResultOrder("ipv4first")` makes Node prefer the A
 *   record of `aws-0-*.pooler.supabase.com`, the pooler's IPv4 route (the
 *   one reachable from Vercel/serverless and most home/office networks).
 *   Node 17+ otherwise returns DNS records verbatim — often AAAA first —
 *   which stalls connections with ENETUNREACH on IPv6-less networks.
 *
 * • Pooling — port 6543 is Supavisor in transaction mode. pg only uses
 *   unnamed statements by default, which is safe there, but session state
 *   (SET/LISTEN/advisory locks) must not be assumed to survive between
 *   queries. Pools are cached on `globalThis` so Next.js hot reload and
 *   repeated serverless invocations reuse connections instead of opening a
 *   fresh set on every request.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function hostnameOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** True for a local/dev Postgres (no TLS, no IPv4 pinning). */
export function isLocalDatabase(connectionString: string): boolean {
  return LOCAL_HOSTNAMES.has(hostnameOf(connectionString));
}

/** Rewrites the connection string to carry `sslmode=no-verify`. */
function withSslModeNoVerify(connectionString: string): string {
  if (/[?&]sslmode=/.test(connectionString)) {
    return connectionString.replace(/([?&]sslmode=)[^&]*/, "$1no-verify");
  }
  const separator = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${separator}sslmode=no-verify`;
}

let ipv4Preferred = false;

/** Pins DNS to the pooler's IPv4 route — see the module docblock. */
function preferIpv4(): void {
  if (ipv4Preferred) return;
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    // Node < 17 resolves IPv4 first by default.
  }
  ipv4Preferred = true;
}

/**
 * Resolves the Postgres connection string.
 *
 * `DATABASE_URL` is the documented variable; `SUPABASE_DB_URL` and
 * `POSTGRES_URL` are accepted as aliases for parity with
 * `scripts/apply-migrations.mjs`. Throws a clear error when none is set.
 */
export function resolveDatabaseUrl(): string {
  const url = (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    ""
  ).trim();

  if (!url) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL. Set it to the " +
        "Supabase pooler connection string, e.g. postgresql://postgres.<ref>:" +
        "<password>@aws-0-eu-west-2.pooler.supabase.com:6543/postgres " +
        "(Vercel → Settings → Environment Variables, or .env.local locally).",
    );
  }
  return url;
}

/** Non-throwing companion of `resolveDatabaseUrl()` for preflight checks. */
export function isDatabaseConfigured(): boolean {
  try {
    resolveDatabaseUrl();
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a `pg.Pool` wired for Supabase. Every option below can be
 * overridden through `options` — callers should rarely need to.
 */
export function createPgPool(options: PoolConfig = {}): Pool {
  const rawUrl = resolveDatabaseUrl();
  const local = isLocalDatabase(rawUrl);

  if (!local) {
    preferIpv4();
  }

  const pool = new Pool({
    // sslmode=no-verify is folded into the URL so every consumer of the
    // string agrees on TLS; the explicit ssl object is the authoritative
    // setting for pg itself and matches it.
    connectionString: local ? rawUrl : withSslModeNoVerify(rawUrl),
    ssl: local ? false : { rejectUnauthorized: false },
    application_name: "sitering-ai",
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ...options,
  });

  // Without this handler an idle client killed by the pooler surfaces as an
  // unhandled 'error' event and takes the whole serverless invocation down.
  pool.on("error", (error) => {
    console.error(
      "[postgres] idle client error (pool will recover):",
      error.message,
    );
  });

  return pool;
}

const globalForPg = globalThis as unknown as { siteringPgPool?: Pool };

/**
 * The pool shared by API routes, cached on `globalThis` so Next.js hot
 * reload and repeated serverless invocations reuse one pool instead of
 * opening a fresh connection set on every request.
 */
export function getSharedPgPool(): Pool {
  if (!globalForPg.siteringPgPool) {
    globalForPg.siteringPgPool = createPgPool();
  }
  return globalForPg.siteringPgPool;
}
