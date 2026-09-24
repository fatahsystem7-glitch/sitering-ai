const SPEC_ENV_KEYS = [
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
];

const EXTRA = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "APP_URL", "DATABASE_URL"];

function missing(keys) {
  return keys.filter((key) => !process.env[key]?.trim());
}

const specMissing = missing(SPEC_ENV_KEYS);
const extraMissing = missing(EXTRA);

if (specMissing.length === 0 && extraMissing.length === 0) {
  console.log("All required environment variables are set.");
  process.exit(0);
}

if (specMissing.length) {
  console.error("Missing spec keys:");
  for (const key of specMissing) console.error(`  - ${key}`);
}
if (extraMissing.length) {
  console.error("Missing additional keys:");
  for (const key of extraMissing) console.error(`  - ${key}`);
}
process.exit(specMissing.length ? 1 : 0);
