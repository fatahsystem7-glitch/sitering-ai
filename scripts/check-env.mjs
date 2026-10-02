/**
 * Verifies that every integration's environment variables are present and
 * readable — the same variables the server routes and API endpoints use.
 *
 *   node scripts/check-env.mjs          # required only
 *   node scripts/check-env.mjs --all    # include optional integrations
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLIENT_SESSION_SECRET",
  "DATABASE_URL",
];

/** DATABASE_URL is also satisfied by its aliases (same as lib/db/postgres.ts). */
function isSet(key) {
  if (key === "DATABASE_URL") {
    return Boolean(
      process.env.DATABASE_URL?.trim() ||
        process.env.SUPABASE_DB_URL?.trim() ||
        process.env.POSTGRES_URL?.trim(),
    );
  }
  return Boolean(process.env[key]?.trim());
}

const INTEGRATIONS = [
  {
    name: "Brevo SMTP (transactional email)",
    ready: (env) =>
      Boolean(
        env.BREVO_SMTP_URL?.trim() ||
          ((env.BREVO_SMTP_LOGIN?.trim() || env.SMTP_USER?.trim()) &&
            (env.BREVO_SMTP_KEY?.trim() || env.SMTP_PASS?.trim())),
      ),
    vars: ["BREVO_SMTP_URL", "BREVO_SMTP_LOGIN/BREVO_SMTP_KEY (or SMTP_USER/SMTP_PASS)"],
  },
  {
    name: "Twilio (telephony + number provisioning)",
    ready: (env) => Boolean(env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim()),
    vars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SIP_TRUNK_SID"],
  },
  {
    name: "LiveKit (voice sessions)",
    ready: (env) =>
      Boolean(env.LIVEKIT_URL?.trim() && env.LIVEKIT_API_KEY?.trim() && env.LIVEKIT_API_SECRET?.trim()),
    vars: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  },
  {
    name: "Fish Audio (expressive TTS)",
    ready: (env) => Boolean(env.FISH_API_KEY?.trim()),
    vars: ["FISH_API_KEY", "FISH_LATENCY_MODE"],
  },
  {
    name: "OpenAI (STT + LLM)",
    ready: (env) => Boolean(env.OPENAI_API_KEY?.trim()),
    vars: ["OPENAI_API_KEY"],
  },
  {
    name: "Stripe (billing)",
    ready: (env) => Boolean(env.STRIPE_SECRET_KEY?.trim()),
    vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    name: "Voice webhooks + cron auth",
    ready: (env) => Boolean(env.VOICE_WEBHOOK_SECRET?.trim()),
    vars: ["VOICE_WEBHOOK_SECRET", "CRON_SECRET"],
  },
  {
    name: "Demo call line",
    ready: (env) =>
      Boolean(env.NEXT_PUBLIC_DEMO_PHONE_NUMBER?.trim() || env.NEXT_PUBLIC_DEMO_CALL_NUMBER?.trim()),
    vars: ["NEXT_PUBLIC_DEMO_PHONE_NUMBER"],
  },
];

const all = process.argv.includes("--all");
let failed = false;

const missing = REQUIRED.filter((key) => !isSet(key));
if (missing.length) {
  console.error("Missing REQUIRED environment variables:");
  for (const key of missing) console.error(`  - ${key}`);
  failed = true;
} else {
  console.log("✓ Required variables are set (Supabase, Postgres + session secret).");
}

const demoFallback = process.env.NEXT_PUBLIC_DEMO_CALL_NUMBER?.trim();
for (const integration of INTEGRATIONS) {
  if (integration.name === "Demo call line" && demoFallback) continue;

  const ready = integration.ready(process.env);
  if (ready) {
    console.log(`✓ ${integration.name} is configured.`);
  } else if (all) {
    console.error(`✗ ${integration.name} is NOT configured. Set: ${integration.vars.join(", ")}`);
    failed = true;
  } else {
    console.warn(`– ${integration.name} not configured (optional): ${integration.vars.join(", ")}`);
  }
}

process.exit(failed ? 1 : 0);
