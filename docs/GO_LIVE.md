# Go-live checklist

Two manual checks can't be automated: hearing a real call, and seeing a real
email land in a real inbox. Everything around them is scripted so those two take
minutes rather than an afternoon.

---

## 0. Preflight (2 min)

```bash
export $(grep -v '^#' .env | xargs)   # or source your Railway env
node scripts/preflight.mjs
```

Read-only — creates nothing, buys nothing, sends nothing. It checks:

- all nine required env vars are present
- your `SUPABASE_SERVICE_ROLE_KEY` really is the service-role key (decodes the JWT — catches the anon-key paste, which fails later in confusing ways)
- Supabase REST reachable, **all migrations applied**, both RPCs callable
- `compliance-docs` bucket exists **and is private** (a public bucket means world-readable passports)
- Twilio credentials valid and **not a Trial account** (trials can't buy UK numbers)
- both GB regulations readable — and it **prints the document types Twilio currently requires for sole traders**, so you'll see it the day they change
- UK local numbers actually in stock
- OpenAI, Fish Audio, Resend keys valid; Resend has a verified domain

Exits non-zero on any required failure. Fix everything before continuing.

---

## 1. Email rendering

### Preview with no key (instant)

```bash
node scripts/preview-emails.mjs
open email-previews/index.html
```

Renders all three templates to disk. Catches layout problems without sending.

### Send to a real inbox

```bash
RESEND_API_KEY=re_xxx \
MAIL_FROM='sitering <hello@yourdomain.com>' \
node scripts/send-test-email.mjs you@yourdomain.com
```

Subjects are prefixed `[TEST]`. This deliberately bypasses `sendOnce()` so it
doesn't burn a dedupe key a real tenant might need.

**Check in the receiving client:**

- [ ] Subject not truncated on mobile (all three are ≤78 chars, asserted in tests)
- [ ] CTA renders as a button — **Outlook strips `border-radius` and some `display` rules**; a plain underlined link is acceptable, an invisible one is not
- [ ] No "[Message clipped]" in Gmail
- [ ] Dark mode doesn't turn dark text on a dark background
- [ ] Plain-text alternative readable on its own
- [ ] Reply-to goes somewhere a human reads
- [ ] Not in spam — if it is, your domain's DKIM/SPF/DMARC isn't right yet

Send from the **same verified domain** as your Supabase auth mail, or the two
build separate sender reputations.

---

## 2. The live call

### Already verified offline

`services/agent/tests/test_shutdown_contract.py` asserts, against the installed
livekit-agents, that: `session.history` is a `ChatContext`, `.items` holds
`ChatMessage` objects with `.role`/`.text_content`, `FunctionCall` has **no**
`text_content` (so tool calls are skipped rather than crashing the transcript
extraction), `session.userdata` raises if never initialised, and
`fishaudio.TTS` still accepts `api_key`/`model`/`voice_id`/`latency_mode`.

Re-run after any dependency bump:

```bash
npm run test:agent
```

What that **can't** tell you: audio quality, latency, barge-in, and whether the
dialled number actually resolves to the right tenant.

### Run it

```bash
# 1. worker against real infra
cd services/agent && python -m sitering_agent.agent dev

# 2. seed a tenant + number mapping if you haven't provisioned one yet
#    (phone_numbers.e164 must exactly match the dialled number, E.164, no spaces)

# 3. ring the number from a mobile
```

**Listen for:**

- [ ] Greeting is the tenant's configured greeting, not the fallback ("Hello, thanks for calling") — the fallback means the number lookup failed
- [ ] Voice is your Fish Audio voice
- [ ] Time-to-first-word feels conversational (`FISH_LATENCY_MODE=low` is the default; `balanced` and `normal` are noticeably slower)
- [ ] You can interrupt mid-sentence
- [ ] It asks for name, number, postcode, job — and doesn't quote a price

**Then check the database:**

```sql
select from_e164, to_e164, duration_secs, outcome, summary,
       jsonb_array_length(transcript) as turns, started_at, ended_at
from calls order by started_at desc limit 1;
```

- [ ] `duration_secs` is non-null and roughly matches the call length
- [ ] `summary` reads like something a busy contractor would skim
- [ ] `outcome` is one of the eight allowed values
- [ ] `turns` matches roughly what you said — **0 turns means the transcript extraction broke**, which is the exact failure the contract tests guard against
- [ ] `ended_at` is set

Worker logs should show one line per call:
`call ended room=… tenant=… duration=42s outcome=booking`

### If the greeting is the fallback

```sql
select e164, status, tenant_id from phone_numbers where e164 = '+44...';
select public.agent_config_for_number('+44...');
```

The RPC only returns rows where `status = 'provisioned'` and the `e164` matches
exactly. A trailing space or a `0044` prefix returns nothing and you get the
fallback agent.

---

## 3. Full sign-up rehearsal

Do this once end-to-end with a real sole-trader identity before opening to
customers, because it's the only way to see a genuine Twilio review:

1. Sign up at `/signup` → confirmation email arrives → click through
2. `/onboarding` as **sole trader**, upload a real passport + utility bill
3. Expect `202` and `pending-review`
4. Wait for Twilio (hours to 2 working days)
5. On approval: number purchased automatically, `number_live` email sent, tenant `active`

**If it's rejected**, that's valuable — capture the payload:

```sql
select failure_reason from compliance_bundles order by created_at desc limit 1;
select payload from provisioning_events where kind = 'bundle.rejected'
order by created_at desc limit 1;
```

Drop the raw evaluation JSON into
`services/telephony-worker/test/fixtures/evaluations.js`, replacing the
`noncompliantSoleTrader` fixture currently marked **SYNTHETIC**, and re-run
`npm run test:telephony`. If `failedRequirements()` stops mapping correctly,
the real shape differs from the documented one and the parser needs adjusting.

---

## 4. Only then

- [ ] `REVALIDATION_SWEEP_ENABLED=true` on exactly one telephony replica
- [ ] Alerting on `provisioning_events.kind = 'revalidation.failed'` — that's a customer whose number stops working at `valid_until`
- [ ] Someone monitors the reply-to inbox
