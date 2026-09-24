/**
 * Required keys from the SiteRing deployment spec.
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is additional: browser auth cannot work without it.
 */
export const SPEC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "CARTESIA_API_KEY",
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_DEMO_PHONE_NUMBER",
] as const;

export const WEB_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ...SPEC_ENV_KEYS] as const;

export const AGENT_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "CARTESIA_API_KEY",
  "OPENAI_API_KEY",
] as const;

export const MIGRATION_ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
] as const;

export type EnvKey = string;

export function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function missingEnv(keys: readonly string[]): string[] {
  return keys.filter((key) => !readEnv(key));
}

export function migrationDatabaseUrl(): string | null {
  for (const key of MIGRATION_ENV_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return null;
}

export function appOrigin(): string {
  const configured = readEnv("APP_URL") || readEnv("NEXT_PUBLIC_APP_URL");
  return configured.replace(/\/$/, "");
}
