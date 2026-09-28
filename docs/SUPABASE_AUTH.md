# Supabase Auth & transactional email

Default Supabase SMTP is rate-limited to a handful of emails per hour and is **not**
usable in production. Wire a custom SMTP provider before your first real sign-up.

## 1. Custom SMTP (recommended baseline)

Dashboard → **Project Settings → Authentication → SMTP Settings** → Enable custom SMTP.

| Field | Resend | Postmark |
|---|---|---|
| Host | `smtp.resend.com` | `smtp.postmarkapp.com` |
| Port | `465` | `587` |
| Username | `resend` | your Server API token |
| Password | your API key | your Server API token |
| Sender email | `hello@sitering.ai` | `hello@sitering.ai` |
| Sender name | `sitering` | `sitering` |

Verify the sending domain (SPF + DKIM + DMARC) with your provider first, or UK
inboxes — especially Outlook/BT — will bin the confirmation emails.

Then raise **Authentication → Rate Limits → Emails per hour** from the default 30.

## 2. Confirmation flow settings

- **Authentication → Providers → Email**: *Confirm email* = ON.
- **Authentication → URL Configuration**:
  - Site URL: `https://app.sitering.ai`
  - Redirect allow-list: `https://app.sitering.ai/auth/callback`, plus `http://localhost:3000/auth/callback` for dev.

The client passes `emailRedirectTo: <origin>/auth/callback?next=/onboarding`
(see `apps/dashboard/src/app/signup/page.tsx`), and the route handler at
`src/app/auth/callback/route.ts` calls `exchangeCodeForSession`.

## 3. Email template

**Authentication → Email Templates → Confirm signup**:

```html
<h2>Welcome to sitering</h2>
<p>Hi {{ .Data.business_name }},</p>
<p>Confirm your email to activate your AI receptionist:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm my account</a></p>
<p>Or enter this code: <strong>{{ .Token }}</strong></p>
<p>The link expires in 24 hours.</p>
```

`{{ .Data.business_name }}` works because sign-up passes `options.data.business_name`,
which lands in `raw_user_meta_data` — the same field the DB trigger reads to name the tenant.

## 4. Send Email Auth Hook (optional, for full control)

If you want branded/templated email through your own service rather than SMTP:

Dashboard → **Authentication → Hooks → Send Email hook** → HTTPS endpoint, e.g.
`https://telephony.sitering.ai/hooks/send-email`, secured with the generated
`v1,whsec_…` secret and verified using standard-webhooks signature checking.
Supabase then POSTs `{ user, email_data: { token, token_hash, redirect_to, email_action_type } }`
and your endpoint does the sending. Leave this off unless you need it — SMTP is simpler.

## 5. What the triggers do

`supabase/migrations/20260928000300_auth_signup.sql`

- `on_auth_user_created` → creates `tenants` + `tenant_members` + a default `agent_configs` row.
- `on_auth_user_confirmed` → flips tenant `onboarding` → `active` when `email_confirmed_at` is first set.

Both are `security definer` so they run regardless of RLS.

## 6. Verifying

```sql
-- after a test signup
select t.business_name, t.status, u.email_confirmed_at
from public.tenants t
join public.tenant_members m on m.tenant_id = t.id
join auth.users u on u.id = m.user_id
order by t.created_at desc limit 5;
```

If a sign-up returns 200 but no email arrives, check **Logs → Auth** for SMTP errors —
it is almost always an unverified sending domain or a hit rate limit.

---

## Operational email (not Supabase)

Supabase Auth only sends signup/confirmation/recovery mail. Everything
operational — renewal reminders, document rejections, "your number is live" —
goes through `services/telephony-worker/src/mailer.js` via Resend.

```
RESEND_API_KEY=       # unset -> mailer logs and no-ops (safe default)
MAIL_FROM=sitering <hello@sitering.ai>
MAIL_REPLY_TO=support@sitering.ai
APP_BASE_URL=https://app.sitering.ai
```

Use the **same verified sending domain** as your Supabase SMTP config, or your
auth mail and your operational mail will build separate sender reputations.

### Idempotency

`sendOnce()` inserts into `public.notifications` *before* calling the provider
and treats a unique-violation (23505) on `(tenant_id, dedupe_key)` as "already
sent". This matters because the revalidation sweep runs daily against the same
open bundles — without it a sole trader would get the same renewal email every
morning until they acted.

| Email | Trigger | Dedupe key |
|---|---|---|
| `renewal_opened` | sole-trader bundle copy opened | `renewal_opened:<bundle_sid>` |
| `documents_rejected` | `twilio-rejected` callback | `documents_rejected:<bundle_sid>:<hash(reason)>` |
| `number_live` | number purchased | `number_live:<e164>` |

Rejection emails hash the reason, so a *different* rejection does send again.

Limited companies never receive `renewal_opened` — their renewal is fully
automated and bothering them would be noise.
