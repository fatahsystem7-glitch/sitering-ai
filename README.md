# SiteRing AI — 24/7 AI Receptionist for UK Trades

> Never miss a £500 job while on the tools.

SiteRing AI answers every call 24/7 for UK plumbers, electricians, builders and
locksmiths — capturing caller name, postcode, issue and urgency, then alerting the
contractor instantly. **£150/mo · 500 minutes included · £0.10/min overage.**

**Hosting cost target: £0/mo** — Vercel (frontend/API) + Supabase Free Tier (database/auth).

---

## Tech Stack

| Layer     | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Next.js 14 (App Router, TypeScript, Server Actions)       |
| Styling   | Tailwind CSS + shadcn/ui-style Radix primitives           |
| Icons     | Lucide React                                              |
| Database  | Supabase Postgres with Row Level Security                 |
| Auth      | Supabase Auth (email/password)                            |
| Billing   | Stripe (subscriptions + metered overage billing)          |
| Voice AI  | LiveKit / Twilio voice agent → `livekit-call-end` webhook |

## Project Structure

```
sitering-ai/
├── app/
│   ├── page.tsx                      # Public landing page
│   ├── login/ & signup/              # Supabase email/password auth
│   ├── dashboard/
│   │   ├── page.tsx                  # KPIs, usage meter, setup guide, call logs
│   │   ├── settings/page.tsx         # Business details, emergency no., billing
│   │   ├── actions.ts                # Server Actions (profile updates, logout)
│   │   └── layout.tsx                # Auth guard + dashboard header
│   └── api/
│       ├── checkout/                 # Stripe Checkout session creator
│       ├── billing-portal/           # Stripe Customer Portal session creator
│       └── webhooks/
│           ├── stripe/               # checkout.session.completed, invoice.paid…
│           └── livekit-call-end/     # Post-call: log + usage + overage billing
├── components/
│   ├── ui/                           # Button, Card, Badge, Dialog, Table…
│   ├── landing/                      # Navbar, Hero, Benefits, Pricing, FAQ…
│   └── dashboard/                    # Header, StatCards, UsageMeter, CallsTable…
├── lib/
│   ├── supabase/{client,server,admin,types}.ts
│   ├── prompts/receptionist.ts       # AI voice receptionist system prompt
│   ├── stripe.ts                     # Stripe client + pricing constants
│   └── utils.ts                      # cn(), formatters, billableMinutes()
├── supabase/migrations/01_schema.sql # profiles, telephony, call_logs + RLS
└── .env.example
```

## Getting Started

### 1. Prerequisites

- Node.js ≥ 18.17
- A [Supabase](https://supabase.com) project (free tier)
- A [Stripe](https://stripe.com) account (test mode is fine)

### 2. Install

```bash
cd sitering-ai
npm install
cp .env.example .env.local
```

### 3. Database — run the migration

Paste `supabase/migrations/01_schema.sql` into your Supabase project's
**SQL Editor** and run it. This creates:

- `profiles` — 1 row per customer (extends `auth.users`)
- `telephony_provisioning` — assigned UK number + `minutes_used_this_period` / 500 cap
- `call_logs` — answered calls with transcripts
- RLS policies (users only see their own rows)
- `handle_new_user()` trigger — auto-creates profile + telephony rows on signup
- `increment_minutes()` RPC — atomic usage increments from the webhook

### 4. Supabase Auth settings

- **Authentication → Providers → Email**: enabled
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` (dev) / your Vercel URL (prod)
  - Redirect URLs: add `http://localhost:3000/auth/callback` (and prod equivalent)

### 5. Stripe setup

1. Create a product **"SiteRing AI Receptionist"** with two prices:
   - **Base**: £150/mo recurring (`STRIPE_PRICE_ID_SUBSCRIPTION`)
   - **Overage**: £0.10/unit, **metered** billing (`STRIPE_PRICE_ID_OVERAGE`)
2. Create a webhook endpoint → `https://<your-domain>/api/webhooks/stripe` with events:
   - `checkout.session.completed`, `invoice.paid`,
     `customer.subscription.updated`, `customer.subscription.deleted`
3. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
4. For local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### 6. Fill in `.env.local`

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID_SUBSCRIPTION="price_..."
STRIPE_PRICE_ID_OVERAGE="price_..."
VOICE_WEBHOOK_SECRET="a-long-random-string"
```

### 7. Run

```bash
npm run dev        # → http://localhost:3000
npm run typecheck  # strict TS check
npm run build      # production build
```

## Voice Agent Integration (LiveKit / Twilio)

After each call, your voice agent should `POST` to:

```
POST /api/webhooks/livekit-call-end
Headers:  x-webhook-secret: <VOICE_WEBHOOK_SECRET>
```

```jsonc
{
  "user_id": "supabase-user-uuid", // OR "assigned_number": "+442045771234"
  "caller_name": "Sarah M.",
  "caller_phone": "+447700900123",
  "trade_issue_summary": "Burst pipe, water through kitchen ceiling",
  "location_postcode": "E14 9RT",
  "urgency_level": "Emergency", // Emergency | Standard Quote | General Enquiry
  "full_transcript": "AI: ...\nCaller: ...",
  "duration_seconds": 95,
}
```

The handler:

1. Validates the payload (Zod) + webhook secret
2. Attributes the call via `user_id` or `assigned_number`
3. Inserts a `call_logs` row
4. Atomically increments `minutes_used_this_period` (rounded up, min 1)
5. If usage exceeds 500, reports **only the newly over-cap minutes** to Stripe metered billing (£0.10/min)

The default voice prompt lives in `lib/prompts/receptionist.ts` — render it per
customer with `renderReceptionistPrompt({ business_name, trade_type })`.

## Call Forwarding (what customers dial)

Customers forward missed calls from any UK mobile:

```
**61*+44SITERINGNUMBER#   →   activate (all networks: EE, O2, Vodafone, Three)
##61#                     →   deactivate
```

The personalised code is shown in the dashboard **Quick Setup** card.

## Deploying to Vercel (£0)

1. Push this repo to GitHub
2. **Vercel → New Project → Import** — framework auto-detected (Next.js)
3. Add all `.env.local` values as **Environment Variables** (update `NEXT_PUBLIC_APP_URL`)
4. Deploy. Then update:
   - Supabase redirect URLs → `https://<app>.vercel.app/auth/callback`
   - Stripe webhook URL → `https://<app>.vercel.app/api/webhooks/stripe`
   - Voice agent webhook → `https://<app>.vercel.app/api/webhooks/livekit-call-end`

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start dev server                 |
| `npm run build`     | Production build                 |
| `npm run start`     | Serve production build           |
| `npm run lint`      | Next.js ESLint                   |
| `npm run typecheck` | Strict TypeScript check          |
| `npm run format`    | Prettier-format all source files |

## Licence

Proprietary — © SiteRing AI Ltd. All rights reserved.
