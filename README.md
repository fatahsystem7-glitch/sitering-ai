# sitering-ai

Multi-tenant AI receptionist SaaS for UK trade contractors.
Supabase (source of truth) · LiveKit + OpenAI + **Fish Audio** (voice) · Twilio (UK numbers & compliance) · Railway + Vercel.

```
sitering-ai/
├─ apps/dashboard/            Next.js 14 app (Vercel) — auth, config UI, provisioning API
├─ services/agent/            Python LiveKit worker (Railway) — OpenAI + Fish Audio TTS
├─ services/telephony-worker/ Node/Express worker (Railway) — Twilio provisioning + webhooks
├─ supabase/migrations/       Schema, RLS, auth triggers, runtime RPC
└─ docs/                      Deploy runbook, auth/SMTP setup, compliance notes
```

## Call flow

```
 UK caller
   │ dials +44…
   ▼
 Twilio number ──POST /webhooks/twilio/voice──► telephony-worker
   │                                              │ returns <Dial><Sip>
   ▼                                              ▼
 LiveKit SIP trunk ──────────► agent worker (Railway)
                                  │ reads dialled number from SIP attributes
                                  │ RPC agent_config_for_number(+44…)  ──► Supabase
                                  │ ◄── tenant prompt, greeting, voice_id, model
                                  ▼
                        OpenAI LLM  +  Fish Audio TTS  +  Deepgram STT
                                  │
                                  └─ writes call row + transcript back to Supabase
```

Prompts are resolved **per call, at call time** — editing a prompt in the dashboard
takes effect on the very next inbound call with no redeploy.

## Sign-up → live number

1. Contractor signs up (`/signup`). Supabase Auth sends the confirmation email.
2. `on_auth_user_created` trigger creates the tenant, owner membership and a default receptionist config.
3. User clicks the link → `/auth/callback` exchanges the code → tenant becomes `active`.
4. `/onboarding` collects entity type, address and contact details — plus, for sole traders, photo ID and proof of address uploaded to a private Supabase Storage bucket.
5. `POST /api/provision` → telephony worker builds the Twilio UK regulatory bundle and returns `202`.
6. Twilio reviews asynchronously and calls `POST /webhooks/twilio/compliance`.
7. On approval the worker buys a UK local number, wires the voice webhook, and marks the tenant live.
8. `/dashboard` shows the live number, compliance state, editable receptionist prompt and recent calls.

### Two compliance branches

UK trades are mostly **sole traders**, who Twilio treats as `end_user_type=individual` —
a materially harder path than a limited company:

| | Limited company | Sole trader |
|---|---|---|
| Twilio end user type | `business` | `individual` |
| Identifier | Companies House CRN (`UK:CRN`) | none |
| Documents | `business_address` (attributes only) | `individual_address` **+ proof of identity + proof of address as uploaded files** |
| Upload host | n/a | `numbers-upload.twilio.com` (multipart) |

Full detail in [`docs/TWILIO_UK_COMPLIANCE.md`](docs/TWILIO_UK_COMPLIANCE.md).

### Keeping numbers alive

Twilio stamps `valid_until` on an approved bundle when the regulation behind it
changes; on that date the bundle is rejected and **the number stops working**.
The worker handles this with the Bundle Copy flow (copy → refresh → evaluate →
submit → `ReplaceItems` → delete copy), so the live bundle never leaves
`twilio-approved` and no number is ever reassigned.

- Limited companies renew with zero contractor involvement.
- Sole traders re-upload ID/address proof at `/dashboard/documents` — never a
  repeat of onboarding.
- A daily sweep (`POST /tasks/revalidate`) backstops missed status callbacks.

## Tests

```bash
npm test                 # everything
npm run test:telephony   # 14 × node:test — Twilio evaluation parser
npm run test:agent       # 10 × pytest  — call summarisation
```

No network, no credentials, no Twilio account needed. The evaluation fixtures are
copied verbatim from Twilio's API reference so the parser is tested against the
documented contract.

## Quick start

```bash
cp .env.example .env            # fill in the nine required keys
npm install
supabase db push                # applies all four migrations
npm run dev:dashboard           # :3000
npm run dev:telephony           # :8080

cd services/agent
pip install -r requirements.txt
python -m sitering_agent.agent download-files
python -m sitering_agent.agent dev
```

## Environment variables

| Variable | Dashboard (Vercel) | Agent (Railway) | Telephony (Railway) |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ✅ | — | — |
| `OPENAI_API_KEY` | — | ✅ | — |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | — | ✅ | — |
| `FISH_API_KEY` | — | ✅ | — |
| `DEEPGRAM_API_KEY` | — | ✅ | — |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | — | — | ✅ |
| `TELEPHONY_WORKER_URL` / `INTERNAL_API_TOKEN` | ✅ | — | ✅ |
| `PUBLIC_BASE_URL` / `LIVEKIT_SIP_URI` | — | — | ✅ |

No Cartesia or ElevenLabs dependency exists anywhere in this repo — Fish Audio is the sole TTS.

See [`docs/DEPLOY.md`](docs/DEPLOY.md) and [`docs/SUPABASE_AUTH.md`](docs/SUPABASE_AUTH.md).
