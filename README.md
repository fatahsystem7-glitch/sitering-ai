# SiteRing AI — 24/7 AI Receptionist for UK Trades

> Stop losing £500+ jobs to voicemail while you're on the tools — or up a ladder.

SiteRing AI answers every call in seconds, 24/7, for UK plumbers, electricians,
builders and locksmiths — qualifying the job, capturing the details, booking the
appointment, and alerting the contractor instantly.
**£150/mo · 500 minutes included · £0.10/min overage · 30-day money-back guarantee.**

**Hosting cost target: £0/mo** — Vercel (frontend/API) + Supabase Free Tier (database/auth).

---

## Public Onboarding → Client ID → Single Dashboard

This is the one and only customer journey in this repo.

1. **`/onboarding`** — a public, 5-step form (no login required):
   1. Business details (name, trade, company/VAT number)
   2. Account owner (name, email, mobile, emergency forwarding number)
   3. Registered UK address (must match the proof of address)
   4. AI receptionist setup (services, areas, hours, tone, instructions)
   5. **Mandatory Telnyx verification uploads** — a copy of their
      **ID (passport / driving licence)** and a copy of their
      **proof of address**, plus a consent declaration.

2. **`POST /api/onboarding`** (multipart) validates everything, inserts a row
   into `public.clients` — which generates the **Client ID (UUID)** — uploads
   both documents to the **private `client-documents` Storage bucket** under
   `<client-id>/…`, records them in `public.client_documents`, and flips the
   account to `telnyx_verification_status = 'submitted'`.

3. The contractor is shown (and emailed) their **Client ID**. That UUID is the
   only credential they need.

4. **`/login`** takes the Client ID, verifies it against Supabase, and sets a
   **HMAC-signed, HttpOnly session cookie** (`sitering_client`, 30 days) so the
   raw UUID can never be forged or brute-forced from the browser.

5. **`/dashboard`** is the single unified dashboard — no separate dashboards.
   Tabs inside one page: **Overview** (verification status, usage, forwarding
   setup, latest activity), **Call logs** (live logs + full transcripts),
   **Messages** (SMS / WhatsApp / voicemail transcripts) and **Settings**
   (account + receptionist profile, saved straight back to Supabase).

`/admin` remains an internal, Supabase-Auth-gated staff area and is unrelated
to the customer flow.

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

### Client ID email

After the account is created, `POST /api/onboarding` emails the contractor
their Client ID via **Resend** (`lib/email.ts`) and can copy your team in.
It is fully optional and never blocks signup: without `RESEND_API_KEY` the
send is skipped, the API returns `email_sent: false`, and the success screen
says "Screenshot it or copy it now" instead of claiming an email was sent.

```bash
RESEND_API_KEY=            # resend.com/api-keys
EMAIL_FROM="SiteRing AI <onboarding@yourdomain.co.uk>"  # verified domain
EMAIL_REPLY_TO=            # optional
ONBOARDING_NOTIFY_EMAIL=   # optional internal copy of each new signup
```

### Required environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only; uploads + dashboard reads
CLIENT_SESSION_SECRET=          # openssl rand -base64 48 (signs the session cookie)
DATABASE_URL=                   # so `npm run build` applies supabase/migrations
```

Apply `supabase/migrations/05_client_onboarding.sql` (automatic on build when
`DATABASE_URL` is set, or paste it into the Supabase SQL editor) before using
the onboarding form.

## Tech Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 14 (App Router, TypeScript, Server Actions)           |
| Styling    | Tailwind CSS + shadcn/ui-style Radix primitives               |
| Icons      | Lucide React                                                  |
| Database   | Supabase Postgres with Row Level Security                     |
| Auth       | Supabase Auth (email/password)                                |
| Billing    | Stripe subscriptions (no trial) + metered overage billing     |
| Voice AI   | Twilio UK SIP → LiveKit Agents → Cartesia Ink-2 STT + Sonic-3 TTS → OpenAI gpt-4o-mini |

## Project Structure

```
sitering-ai/
├── app/
│   ├── page.tsx                      # Direct-response landing page
│   ├── login/ & signup/              # Supabase email/password auth
│   ├── dashboard/                    # Client portal (KPIs, usage, calls, settings)
│   ├── admin/                        # Staff-only: overview, customers, conversations
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
│   ├── site.ts                       # Public constants (demo-call number)
│   ├── supabase/{client,server,admin,types}.ts
│   ├── prompts/receptionist.ts       # AI voice receptionist system prompt
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

`npm run build` applies `supabase/migrations/*.sql` when `DATABASE_URL` is set.
A missing URL warns and continues. A set URL that fails SQL stops the build.
The SQL editor is not required.

1. `01_schema.sql` — profiles, telephony, call logs, RLS
2. `02_admin.sql` — admin flags and call enrichment
3. `03_business_profiles.sql` — receptionist profile, demo setting, callbacks

### Voice agent

The Next.js app does not run the call. From `agent/`:

```bash
npm install
npm start
```

Inbound UK Twilio SIP enters LiveKit. The worker uses Cartesia Ink-2 for speech-to-text, Cartesia Sonic-3 for speech, and OpenAI `gpt-4o-mini`. End of turn comes from the STT stream. When the call ends it posts to `/api/webhooks/livekit-call-end`. `send_booking_link` texts `booking_url`.

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

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start dev server             |
| `npm run build`     | Production build             |
| `npm run start`     | Serve production build       |
| `npm run lint`      | Next.js ESLint               |
| `npm run typecheck` | Strict TypeScript check      |
| `npm run format`    | Prettier-format source files |

## Licence

Proprietary — © SiteRing AI Ltd. All rights reserved.
