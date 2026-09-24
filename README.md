# SiteRing AI

24/7 AI receptionist for UK trade contractors. One plan: **£150 / month**, **500 minutes included**.

The call path is Twilio (+44) → LiveKit SIP → a LiveKit Agents worker. Speech-to-text is Cartesia Ink (`ink-2`). Speech is Cartesia Sonic-3. The brain is OpenAI `gpt-4o-mini`. Turn-taking uses Cartesia STT endpointing (`turnDetection: "stt"`), with LiveKit VAD only so the caller can interrupt.

## What ships

- Landing page with the £150 plan, a theme toggle, and a Live Demo Call button that uses `tel:` on mobile.
- Sign-up, onboarding, and `/dashboard/settings` share one business profile form. Data is stored in Supabase `business_profiles`.
- “Import from URL” calls `/api/import-business`, which reads the public page and asks `gpt-4o-mini` to fill the form. It will not invent prices.
- On each inbound call the worker looks up the dialed number, builds a system prompt from that profile, and can text the booking link via the `send_booking_link` tool.
- `/admin` shows MRR, minute consumption, active accounts, call history, and the 4-provider margin model (£9.40 infra, £2.45 Stripe, £138.15 net, ~92%).
- `npm run build` applies `supabase/migrations` when a Postgres URL is set. SQL is idempotent (`IF NOT EXISTS`).

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required keys (also checked by `npm run check-env` and `/api/health`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `CARTESIA_API_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_DEMO_PHONE_NUMBER`

Also set `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser auth) and `DATABASE_URL` (migration runner). `APP_URL` must be the public origin Twilio calls back to.

Paste a British Sonic-3 voice id into `CARTESIA_VOICE_ID`. Without it, the Cartesia plugin default voice is used.

Use Node 22 (the Supabase client requires it). Vercel will pick that up from `engines`.

Admin access: set `ADMIN_EMAILS` or `profiles.role = 'admin'`.

## Telephony

1. Deploy this Next.js app (Vercel) so `/api/twilio/voice` is public.
2. Deploy the worker in an EU LiveKit Cloud region so UK callers stay close to the media path:

   ```bash
   npm run agent:start
   ```

   The worker name is `sitering-receptionist` unless `LIVEKIT_AGENT_NAME` is set.
3. From Settings, assign a +44 number. That buys a Twilio local number, points its voice webhook at `/api/twilio/voice`, and adds the number to a LiveKit inbound trunk plus a dispatch rule for this agent.
4. UK geographic numbers often need a Twilio regulatory bundle before purchase. If Twilio refuses, buy the number in the console and use “Register existing”.

`/api/twilio/voice` answers with TwiML that dials LiveKit SIP. Set `LIVEKIT_SIP_HOST` if it cannot be derived from `LIVEKIT_URL`.

## Database

Migrations live in `supabase/migrations`. `npm run build` and `npm run migrate` apply any file not recorded in `schema_migrations`, using `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`. If none is set, the web build continues and logs a warning so a frontend-only preview can still deploy.

## Checks

```bash
npm run lint
npm test
npm run type-check
```

## Deploy

Connect this repository to Vercel. The build command is `npm run build`. Run the agent as a long-lived process (LiveKit Cloud or the included `Dockerfile`); it cannot run inside a Vercel serverless function.

```bash
git push origin main
```
