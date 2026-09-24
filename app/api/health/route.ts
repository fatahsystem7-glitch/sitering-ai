import { NextResponse } from "next/server";
import { SPEC_ENV_KEYS, WEB_ENV_KEYS, missingEnv, migrationDatabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const specMissing = missingEnv(SPEC_ENV_KEYS);
  const webMissing = missingEnv(WEB_ENV_KEYS);
  return NextResponse.json({
    ok: specMissing.length === 0 && webMissing.length === 0,
    stack: ["twilio", "livekit", "cartesia", "openai"],
    specMissing,
    webMissing,
    migrationsConfigured: Boolean(migrationDatabaseUrl()),
  });
}
