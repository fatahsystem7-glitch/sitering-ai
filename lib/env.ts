/**
 * Runtime environment-variable validation — the single source of truth for
 * which variables the server requires and the exact error shown when one is
 * missing.
 *
 * `scripts/check-env.mjs` mirrors this list for CLI / pre-deploy checks and
 * `GET /api/admin/diagnostics` reports the same live from the server.
 *
 * Kept free of Node built-ins so it is safe to import from any module,
 * Edge runtime included.
 */

/**
 * Variables the server needs before it can serve database-backed traffic.
 *
 * `DATABASE_URL` is satisfied by the `SUPABASE_DB_URL` / `POSTGRES_URL`
 * aliases too — see `resolveDatabaseUrl()` in `lib/db/postgres.ts`.
 */
export const REQUIRED_SERVER_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RequiredServerEnv = (typeof REQUIRED_SERVER_ENV)[number];

/** Returns the subset of `names` that is absent or blank. */
export function getMissingEnv(names: readonly string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim());
}

/** Human-readable error text for a list of missing variables. */
export function formatMissingEnv(missing: readonly string[]): string {
  const label = missing.length === 1 ? "variable" : "variables";
  return (
    `Missing required environment ${label}: ${missing.join(", ")}. ` +
    "Set them in Vercel → Project → Settings → Environment Variables " +
    "(or .env.local locally), then redeploy or restart the server."
  );
}

/**
 * Reads one required variable, throwing a clear, actionable error if it is
 * absent or blank. Values are trimmed so stray whitespace never becomes part
 * of a credential or connection string.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(formatMissingEnv([name]));
  }
  return value;
}
