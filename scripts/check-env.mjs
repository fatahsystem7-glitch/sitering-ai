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

const missing = SPEC_ENV_KEYS.filter((key) => !process.env[key]?.trim());
const demoFallback = process.env.NEXT_PUBLIC_DEMO_CALL_NUMBER?.trim();
const required = missing.filter(
  (key) => key !== "NEXT_PUBLIC_DEMO_PHONE_NUMBER" || !demoFallback,
);

if (required.length === 0) {
  console.log("Required environment variables are set.");
  process.exit(0);
}

console.error("Missing environment variables:");
for (const key of required) console.error(`  - ${key}`);
process.exit(1);
