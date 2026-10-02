# SiteRing AI — 24/7 AI Receptionist for UK Trades

> Stop losing £500+ jobs to voicemail while you're on the tools — or up a ladder.

SiteRing AI answers every call in seconds, 24/7, for UK plumbers, electricians,
builders and locksmiths — qualifying the job, capturing the details, booking the
appointment, and alerting the contractor instantly.
**£150/mo · 500 minutes included · £0.10/min overage · 30-day money-back guarantee.**

**Hosting cost target: £0/mo** — Vercel (frontend/API) + Supabase Free Tier (database/auth).

---

## Public Onboarding → Email + Password → Single Dashboard

This is the one and only customer journey in this repo.

1. **`/onboarding`** (also served at `/signup`) — a public, 5-step form (no
   login required):
   1. Business details (name, trade, company/VAT number)
   2. Account owner (name, **email + password**, mobile, emergency forwarding)
   3. Registered UK address (must match the proof of address)
   4. AI receptionist setup (services, areas, hours, tone, instructions)
   5. **Mandatory Twilio verification uploads** — a copy of their
      **ID (passport / driving licence)** and a copy of their
      **proof of address**, plus the GDPR consent box and the Twilio sharing
      declaration.

2. **`POST /api/onboarding`** (multipart) validates everything, creates the
   **Supabase Auth user** for the email + password they just chose, then
   inserts a row into `public.clients` — which generates the **Client ID
   (UUID)** and stores `owner_auth_user_id` — uploads both documents to the
   **private `client-documents` Storage bucket** under `<client-id>/…`, records
   them in `public.client_documents`, timestamps the GDPR consent, submits the
   Twilio regulatory bundle and then **attempts to buy the phone number
   immediately** (most UK bundles are reviewed asynchronously, in which case the
   daily compliance cron finishes the purchase the moment Twilio approves). If
   the row insert fails, the freshly created Auth user is rolled back so a retry
   isn't stuck on "already registered".

3. The contractor is **signed straight in** (`signed_in: true` in the response)
   and shown a success screen that leads with their login. The **Client ID is
   now an account reference rather than a credential** — it is what support
   quotes to find an account, and the dashboard labels it *Account reference
   (Client ID)*.

4. **`/login`** has three modes — **email + password** (default), *Forgot
   password?* (emails a Supabase recovery link that `/auth/callback` exchanges,
   landing on `/reset-password`), and a legacy **Client ID** form.

5. **`/dashboard`** is the single unified dashboard — no separate dashboards.
   Tabs inside one page: **Overview** (verification status, usage, forwarding
   setup, latest activity), **Call logs** (live logs + full transcripts),
   **Messages** (SMS / WhatsApp / voicemail transcripts) and **Settings**
   (account + receptionist profile, saved straight back to Supabase).

### Two logins, one dashboard

Accounts created **before** migration 08 have no Supabase Auth user
(`owner_auth_user_id` is `NULL`) and keep signing in with their **Client ID**,
verified against Supabase and carried in an **HMAC-signed, HttpOnly session
cookie** (`sitering_client`, 30 days) so the raw UUID can never be forged or
brute-forced from the browser. `getCurrentClient()` in `lib/client-session.ts`
resolves both kinds of account, and `/dashboard` accepts either.

Client-ID login is **refused for accounts that have a password** — for those the
Client ID is emailed, screenshotted and quoted to support, so it must not grant
access on its own.

> **There is deliberately no "sign up again with your old email to claim your
> account" path.** `/api/onboarding` is public and unauthenticated, so matching
> an existing row on email alone would let anyone who knows a contractor's
> address take over their account, overwrite their details and drive their
> Twilio provisioning. Duplicate emails are rejected, exactly as before, backed
> by the unique index on `lower(email)`. Moving a legacy account to email +
> password requires an explicit, emailed claim link whose token only the real
> owner receives.

`/admin` remains an internal staff area and is unrelated to the customer flow:
middleware requires a Supabase Auth user (the Client-ID cookie deliberately does
not count there) and the layout calls `requireAdmin()`, which checks
`profiles.is_admin` / `profiles.role`.

### Data written to Supabase

| Table | Purpose |
| --- | --- |
| `clients` | One row per account. `clients.id` **is** the Client ID. |
| `client_documents` | Audit trail of each uploaded KYC document. |
| `call_logs.client_id` | Calls attributed to a client. |
| `message_logs` | Message/voicemail transcripts for the dashboard. |
| Storage `client-documents` | Private bucket holding ID + proof of address. |

Webhooks: `POST /api/webhooks/livekit-call-end` and
`POST /api/webhooks/message` both accept `client_id` (or `assigned_number`)
and authenticate with the `x-webhook-secret` header.

### Email · Brevo SMTP (Nodemailer)

Transactional email is sent through **Brevo SMTP** with a **Nodemailer**
helper consolidated into `lib/email.ts` (the standalone helper from the
earlier test deployment now lives here, in the single project). It emails the
contractor their Client ID at signup, the number-live email when provisioning
completes, and can copy your team in on each new signup.

It is fully optional and never blocks signup: without SMTP credentials the
send is skipped, the API returns `email_sent: false`, and the success screen
says "Screenshot it or copy it now" instead of claiming an email was sent.

```bash
# Brevo dashboard → SMTP & API → SMTP. Either the single URL…
BREVO_SMTP_URL="smtp://<smtp-login>:<smtp-key>@smtp-relay.brevo.com:587"
# …or the discrete pair:
BREVO_SMTP_LOGIN=""        # Brevo SMTP login
BREVO_SMTP_KEY=""          # Brevo SMTP key
SMTP_HOST="smtp-relay.brevo.com"  # default
SMTP_PORT="587"                   # default (465 = implicit TLS)
EMAIL_FROM="SiteRing AI <onboarding@yourdomain.co.uk>"  # validated Brevo sender
EMAIL_REPLY_TO=""          # optional
ONBOARDING_NOTIFY_EMAIL="" # optional internal copy of each new signup
```

`npm run check-env` verifies every integration's variables (Supabase, Twilio,
Brevo SMTP, LiveKit, Stripe, Fish Audio, OpenAI) are present; add `--all` to
fail on optional integrations too. Once deployed, `GET /api/admin/diagnostics`
(admin session required) reports the same live from the server, including the
effective modular voice pipeline.

### Required environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only; uploads + dashboard reads
CLIENT_SESSION_SECRET=          # openssl rand -base64 48 (signs the session cookie)
DATABASE_URL=                   # Postgres pooler — runtime writes + `npm run db:migrate`
```

Apply `supabase/migrations/*.sql` before using the onboarding form:
`npm run db:migrate` (reads `DATABASE_URL`, or `.env.local`), or paste the
files into the Supabase SQL editor. Migrations are **never** run during
`npm run build` — the build compiles only and does not touch the database.

## Tech Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 14 (App Router, TypeScript, Server Actions)           |
| Styling    | Tailwind CSS + shadcn/ui-style Radix primitives               |
| Icons      | Lucide React                                                  |
| Database   | Supabase Postgres with Row Level Security                     |
| Auth       | Supabase Auth (email/password)                                |
| Email      | Brevo SMTP via Nodemailer (transactional)                     |
| Billing    | Stripe subscriptions (no trial) + metered overage billing     |
| Voice AI   | Twilio UK SIP → LiveKit Agents → OpenAI gpt-4o-transcribe STT + Fish Audio s2.1-pro TTS → OpenAI gpt-4o-mini |

## Project Structure

```
sitering-ai/
├── app/
│   ├── page.tsx                      # Direct-response landing page
│   ├── login/ & signup/              # Supabase email/password auth
│   ├── dashboard/                    # Client portal (KPIs, usage, calls, settings)
│   ├── admin/                        # Staff-only: overview, customers, conversations, voice
│   ├── terms/ & privacy/             # Legal templates (ToS + UK GDPR privacy policy)
│   ├── demo/ & admin-demo/           # No-login mock previews (sample data)
│   └── api/
│       ├── checkout/                 # Stripe Checkout session (no trial)
│       ├── billing-portal/           # Stripe Customer Portal
│       └── webhooks/
│           ├── stripe/               # checkout.session.completed, invoice.paid…
│           └── livekit-call-end/     # Post-call: log + usage + overage billing
├── components/
│   ├── ui/                           # Button, Card, Badge, Dialog, Table…
│   ├── landing/                      # Hero, Problem, Solution, DemoCall, Pricing…
│   ├── dashboard/                    # Client portal components
│   └── admin/                        # MetricCards, CustomersTable, ConversationsExplorer
├── lib/
│   ├── admin.ts                      # requireAdmin() guard + admin types
│   ├── email.ts                      # Brevo SMTP + Nodemailer helper
│   ├── site.ts                       # Public constants (demo-call number)
│   ├── supabase/{client,server,admin,types}.ts
│   ├── prompts/receptionist.ts       # AI voice receptionist system prompt
│   ├── prompts/admin-config.ts       # Voice Studio configuration prompt
│   ├── twilio/                       # client, compliance, provisioning, sync
│   ├── voice/                        # Modular provider settings + param sync
│   ├── stripe.ts                     # Stripe client + pricing constants
│   └── utils.ts
├── supabase/migrations/
│   ├── 01_schema.sql                 # profiles, telephony, call_logs + RLS
│   └── 02_admin.sql                  # is_admin/role, admin RLS, call enrichment
└── .env.example
```

## Getting Started

### 1. Prerequisites

- Node.js ≥ 18.17 (22+ recommended)
- A [Supabase](https://supabase.com) project (free tier)
- A [Stripe](https://stripe.com) account (test mode is fine)

### 2. Install

```bash
cd sitering-ai
npm install
cp .env.example .env.local
```

### 3. Database

`npm run db:migrate` applies `supabase/migrations/*.sql` in order (tracks
progress in a `schema_migrations` table). It reads `DATABASE_URL` — falling
back to `.env.local`/`.env` locally — and fails loudly if neither is set.
`npm run build` never runs migrations, so deployments cannot fail on DDL or
build-container SSL limits. The Supabase SQL editor works too if you prefer.

1. `01_schema.sql` — profiles, telephony, call logs, RLS
2. `02_admin.sql` — admin flags and call enrichment
3. `03_business_profiles.sql` — receptionist profile, demo setting, callbacks
4. `04_leads.sql` — landing-funnel lead intake
5. `05_client_onboarding.sql` — clients, documents, dashboard tables
6. `06_twilio_compliance.sql` — Twilio regulatory state
7. `07_voice_configuration.sql` — voice provider settings, config audit trail, GDPR consent columns

### Voice agent

The Next.js app does not run the call. From `agent/`:

```bash
npm install
npm start
```

Inbound UK Twilio SIP enters LiveKit. The worker uses OpenAI `gpt-4o-transcribe` for speech-to-text, Fish Audio `s2.1-pro` for speech, and OpenAI `gpt-4o-mini` for the conversation. End of turn comes from the STT stream. When the call ends it posts to `/api/webhooks/livekit-call-end`. `send_booking_link` texts `booking_url`.

### 4. Admin account

The bootstrap admin (**abdelfatah maghraoui**,
`d79a90f4-e324-40fc-b942-3d71246c4f74`) is **automatically flagged**
`is_admin = true` / `role = 'admin'` by the signup trigger in migration 02.
Just sign up with that Supabase user and visit `/admin`.

To verify or manually grant admin:

```sql
select id, business_name, is_admin, role from profiles;
update profiles set is_admin = true, role = 'admin'
where id = 'd79a90f4-e324-40fc-b942-3d71246c4f74';
```

`/admin` is protected three ways: middleware requires login, the layout calls
`requireAdmin()` (non-admins → `/dashboard`), and a client-side `<AdminGate>`
renders an access-denied card as defence-in-depth.

### 5. Supabase Auth settings

- **Authentication → Providers → Email**: enabled
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` (dev) / your Vercel URL (prod)
  - Redirect URLs: add `http://localhost:3000/auth/callback` (and prod equivalent)

### 6. Stripe setup (no trial — billing starts immediately)

1. Create a product **"SiteRing AI Receptionist"** with two prices:
   - **Base**: £150/mo recurring (`STRIPE_PRICE_ID_SUBSCRIPTION`)
   - **Overage**: £0.10/unit, **metered** billing (`STRIPE_PRICE_ID_OVERAGE`)
2. Webhook endpoint → `https://<your-domain>/api/webhooks/stripe` with events:
   - `checkout.session.completed`, `invoice.paid`,
     `customer.subscription.updated`, `customer.subscription.deleted`
3. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### 7. Fill in `.env.local`

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
BREVO_SMTP_LOGIN="..."                       # Brevo SMTP (email)
BREVO_SMTP_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID_SUBSCRIPTION="price_..."
STRIPE_PRICE_ID_OVERAGE="price_..."
NEXT_PUBLIC_DEMO_CALL_NUMBER="+44 20 3966 1248"  # live test line on landing page
VOICE_WEBHOOK_SECRET="a-long-random-string"
```

### 8. Run

```bash
npm run dev        # → http://localhost:3000
npm run typecheck  # strict TS check
npm run build      # production build
```

Preview routes (no login, sample data): `/demo` (client dashboard),
`/admin-demo` (admin dashboard).

## Admin Dashboard (`/admin`)

Staff-only. Overview shows **MRR** (active × £150), **active subscribers**,
**total minutes used** and **overage revenue** (minutes over cap × £0.10).
Customers tab lists every account with business, trade, UK number, status,
usage — plus **pause/resume answering** and **minute-cap adjustment**.
Conversations tab searches every call across accounts with transcripts, AI
summaries, recordings (when the voice agent attaches `recording_url`) and
repeat-caller history.

## Admin Voice Studio (`/admin/voice`)

The administrator picks a client account, clicks **Launch live voice session**
and configures that client's AI receptionist — business name, operating
hours, services, greeting style, extra instructions — by *talking* to the
configuration agent over LiveKit WebRTC.

- `POST /api/admin/voice/session` creates the room `voice-config-<client_id>`,
  dispatches the agent and returns a browser join token.
- The agent (same worker as the phone line) runs the configuration prompt and
  calls `update_receptionist_config` the moment a parameter is confirmed.
- `POST /api/webhooks/voice-config` (secret-authenticated, service role)
  writes each captured parameter straight to that client's row in Supabase,
  appends an audit row to `voice_config_updates`, and the studio panel updates
  live over the room's data channel.
- A manual form on the same page covers the same fields by keyboard.

### Modular voice providers

The pipeline assembles itself per session from `voice_provider_settings`
(edited in the studio; env fallback):

| Slot | Options |
| --- | --- |
| TTS | **Fish Audio** `fishaudio/s2.1-pro` (default) · `s2.1-mini` · **OpenAI** `tts-1` / `gpt-4o-mini-tts` |
| STT | OpenAI `gpt-4o-transcribe` (default) · `whisper-1` |
| LLM | OpenAI `gpt-4o-mini` (default) · `gpt-4o` |

Fish Audio's latency mode (`low` by default) trades a little prosody for a
faster first syllable — what you want on a phone call.

## Legal & GDPR

- `/terms` and `/privacy` render full Terms of Service and Privacy Policy
  (UK GDPR / Data Protection Act 2018) templates, linked from the landing
  footer and the dashboard footer.
- Every customer-facing data-collection form carries a consent checkbox:
  the 5-step signup (required GDPR consent, recorded on `clients` with a
  timestamp + optional marketing consent) and the landing funnel (required
  consent, recorded on `leads`).
- KYC uploads additionally require the explicit Twilio-sharing declaration.

## Voice Agent Integration (LiveKit / Twilio)

After each call, your voice agent should `POST` to:

```
POST /api/webhooks/livekit-call-end
Headers:  x-webhook-secret: <VOICE_WEBHOOK_SECRET>
```

```jsonc
{
  "user_id": "supabase-user-uuid",   // OR "assigned_number": "+442045771234"
  "caller_name": "Sarah M.",
  "caller_phone": "+447700900123",
  "trade_issue_summary": "Burst pipe, water through kitchen ceiling",
  "location_postcode": "E14 9RT",
  "urgency_level": "Emergency",      // Emergency | Standard Quote | General Enquiry
  "full_transcript": "AI: ...\nCaller: ...",
  "duration_seconds": 95
  // Optional enrichment (stored when provided):
  // "ai_summary": "Emergency burst pipe…",
  // "recording_url": "https://…signed-url…"
}
```

The handler validates (Zod) + attributes the call, inserts `call_logs`,
atomically increments usage (rounded up, min 1 min), and reports only newly
over-cap minutes to Stripe metered billing (£0.10/min).

The default voice prompt lives in `lib/prompts/receptionist.ts`.

The optional `ai_summary` and `recording_url` fields are stored when provided
and surfaced in the admin Conversations view (summary card + audio player).

## Call Forwarding (what customers dial)

```
**61*+44SITERINGNUMBER#   →   activate (EE, O2, Vodafone, Three…)
##61#                     →   deactivate
```

Personalised steps live in the dashboard Quick Setup card **and** the
subscriber settings page.

## Deploying to Vercel (£0)

1. Push this repo to GitHub (Vercel auto-deploys on push once connected)
2. **Vercel → New Project → Import** the repo (one-time connection)
3. Add all `.env.local` values as **Environment Variables**
4. Update Supabase redirect URLs, Stripe webhook URL and voice-agent webhook
   to the production domain
5. Apply the schema once per environment — from your machine run
   `DATABASE_URL=<pooler-url> npm run db:migrate` (or paste
   `supabase/migrations/*.sql` into the Supabase SQL editor). Vercel's build
   phase never executes migrations, so a schema change is never able to
   break a deployment

`vercel.json` schedules the compliance poll (`/api/compliance/poll`) **daily
at 00:00 UTC** (`0 0 * * *`) — the Hobby plan only allows cron jobs that run
once per day, and an hourly schedule blocks the deployment.

## Scripts

| Command               | Description                                        |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Start dev server                                   |
| `npm run build`       | Production build (no database access)              |
| `npm run start`       | Serve production build                             |
| `npm run db:migrate`  | Apply `supabase/migrations/*.sql` manually         |
| `npm run check-env`   | Verify required environment variables              |
| `npm run check:speech`| Assert Fish Audio + OpenAI voice stack             |
| `npm run lint`        | Next.js ESLint                                     |
| `npm run typecheck`   | Strict TypeScript check                            |
| `npm run format`      | Prettier-format source files                       |

## Licence

Proprietary — © SiteRing AI Ltd. All rights reserved.
