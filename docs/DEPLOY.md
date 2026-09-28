# Deploy runbook — GitHub → Railway + Vercel

## 0. Push the repo

```bash
cd sitering-ai
git init -b main
git add .
git commit -m "feat: sitering-ai multi-tenant AI receptionist platform"
gh repo create <your-org>/sitering-ai --private --source=. --push
# or: git remote add origin git@github.com:<your-org>/sitering-ai.git && git push -u origin main
```

## 1. Supabase

```bash
supabase link --project-ref <ref>
supabase db push          # applies all four migrations in order
```

Then follow `docs/SUPABASE_AUTH.md` for SMTP + redirect URLs.
Grab `SUPABASE_URL`, the `anon` key and the `service_role` key from
**Project Settings → API**. The service-role key is a root credential — Railway
and Vercel server env only, never `NEXT_PUBLIC_`.

## 2. Railway — one project, two services

Create project `sitering-ai`, connect the GitHub repo, then add two services from
the same repo with different root directories:

| Service | Root directory | Builder |
|---|---|---|
| `agent` | `services/agent` | Dockerfile |
| `telephony` | `services/telephony-worker` | Dockerfile |

Each already has a `railway.json` pinning `DOCKERFILE` builder and an
`ON_FAILURE` restart policy.

**`agent` variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`OPENAI_MODEL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`LIVEKIT_AGENT_NAME`, `FISH_API_KEY`, `FISH_TTS_MODEL`, `FISH_DEFAULT_VOICE_ID`,
`DEEPGRAM_API_KEY`, `LOG_LEVEL`.
No public domain needed — it dials out to LiveKit.

**`telephony` variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `INTERNAL_API_TOKEN` (generate with
`openssl rand -hex 32`), `LIVEKIT_SIP_URI`, `NODE_ENV=production`, and
`PUBLIC_BASE_URL` = the public Railway domain you generate for this service.
Twilio signature validation depends on `PUBLIC_BASE_URL` exactly matching the
URL Twilio calls, including https and any custom domain.

Shared keys are easiest as Railway **shared variables** referenced as `${{shared.SUPABASE_URL}}`.

## 3. LiveKit SIP

```bash
lk sip inbound create --request '{
  "name": "sitering-inbound",
  "numbers": [],
  "krisp_enabled": true
}'
```

Leave `numbers` empty so the trunk accepts every tenant number, then create a
dispatch rule routing each call into its own room with agent name
`sitering-receptionist`. Copy the trunk's SIP URI into `LIVEKIT_SIP_URI` on the
telephony service.

## 4. Vercel

Import the repo, set **Root Directory** to `apps/dashboard` (Vercel then ignores
the monorepo `vercel.json` build override — either works, pick one).

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TELEPHONY_WORKER_URL`, `INTERNAL_API_TOKEN`.

## 5. Smoke test

```bash
curl https://<telephony-domain>/health
# {"ok":true,"service":"telephony-worker"}

# sign up in the UI, confirm the email, then:
curl -X POST https://app.sitering.ai/api/provision \
  -H 'content-type: application/json' -b "$SESSION_COOKIE" \
  -d '{"tenantId":"<uuid>","business":{...},"areaCode":"20"}'
# 202 Accepted -> bundle pending Twilio review
```

Watch `public.provisioning_events` for the trail:
`tenant.created → provision.requested → bundle.submitted → bundle.status → number.purchased`.

## 6. Bundle re-verification

Handled automatically — see `docs/TWILIO_UK_COMPLIANCE.md`. Two things to set up:

**Env on the telephony service**

```
REVALIDATION_WINDOW_DAYS=30      # start chasing 30 days before valid_until
REVALIDATION_SWEEP_ENABLED=true  # false on every replica except one
```

**Optional Railway Cron** (belt and braces — the worker already sweeps daily on
its own timer):

```bash
curl -X POST https://<telephony-domain>/tasks/revalidate \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -H 'content-type: application/json' -d '{"windowDays":30}'
```

Force a sweep manually any time with the same call. Response reports how many
bundles were checked and what happened to each.

## 7. Ongoing

- Rotate `INTERNAL_API_TOKEN` and the service-role key on any staff offboarding.
- `agent` scales horizontally: add Railway replicas; LiveKit load-balances jobs across workers.
- If you scale `telephony` past one replica, only one may have
  `REVALIDATION_SWEEP_ENABLED=true` or you'll open duplicate bundle copies.
- Watch `provisioning_events` for `revalidation.failed` — that's a customer whose
  number will stop working at `valid_until` if nobody intervenes.
