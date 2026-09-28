# Twilio UK regulatory compliance — what actually blocks you

UK local numbers (`+44 20`, `+44 161`, …) require an **approved Regulatory Bundle**
before Twilio will sell you one. Since 30 September 2024 this applies to every UK
long code, new or existing. Review is asynchronous and human, so the platform is
built around a webhook, not a synchronous purchase.

There are **two different regulations** and they are not close to each other.
`services/telephony-worker/src/twilio-compliance.js` branches on `entity_type`.

## Branch A — Limited company (`end_user_type=business`)

```
Address (real UK trading premises, emergencyEnabled)
   └── Supporting Document: business_address   ← attributes only, NO file
End User: business
   ├── business_name, business_registration_number (CRN), UK:CRN identifier
   ├── authorised representative name / email / mobile
   └── isv_reseller_or_partner
        └──► Bundle (iso_country=GB, number_type=local, end_user_type=business)
```

No file uploads. The whole branch is JSON. This is the cheap path.

## Branch B — Sole trader (`end_user_type=individual`)

```
Address (real UK address, emergencyEnabled)
   └── Supporting Document: individual_address       ← attributes only
End User: individual (first_name, last_name, email, phone_number, comments)
Supporting Document: proof of identity               ← FILE UPLOAD
   └── passport | government_issued_document
Supporting Document: proof of address                ← FILE UPLOAD
   └── utility_bill | tax_notice | rent_receipt | title_deed
       | government_issued_document showing the UK address
        └──► Bundle (…, end_user_type=individual)
```

The two proofs are **real files**, and they do not go to `numbers.twilio.com`.
They must be POSTed as `multipart/form-data` to:

```
https://numbers-upload.twilio.com/v2/RegulatoryCompliance/SupportingDocuments
```

The Twilio Node helper does not wrap this host, so `twilio-documents.js` hand-rolls
the request with `fetch` + `FormData` and HTTP Basic auth.

### How files get there

1. Contractor uploads in `/onboarding` straight to the private Supabase Storage
   bucket `compliance-docs`, at `compliance-docs/<tenant_id>/<requirement>-<uuid>.<ext>`.
2. A row lands in `public.compliance_documents` recording the requirement,
   the chosen Twilio document type, and the storage path.
3. Storage RLS: the first path segment is the tenant id, so `member_of(folder)` is
   the entire access rule — one contractor can never read another's passport.
4. At provision time the worker pulls each file with the service-role client,
   uploads it to Twilio, and writes back the `RD…` SID with `upload_status='uploaded'`.
5. On `twilio-rejected` the documents are flipped to `rejected` so the next attempt
   re-uploads fresh files instead of resending the ones that just failed.

Bucket is private, capped at 10 MB, and limited to PNG/JPEG/WebP/PDF.

## Bundle statuses

| Status | Meaning | Our action |
|---|---|---|
| `draft` | Evaluation failed — fields missing | Return 422 with the parsed field list; never submit |
| `pending-review` | Submitted, queued | Wait |
| `in-review` | Twilio reviewing | Wait |
| `twilio-approved` | Approved | Purchase number, tenant → `active` |
| `provisionally-approved` | Conditional | Purchase; re-verification due at `valid_until` |
| `twilio-rejected` | Rejected | Mark documents rejected, prompt re-upload |

We always run `evaluations.create()` before flipping to `pending-review`. A failed
evaluation names the exact broken field and costs seconds; a rejected bundle costs days.

## Gotchas that cause rejections

- **No PO boxes, mailbox services or virtual offices.** Instant rejection as proof of address.
- **Names must match exactly** across end user, address and every document. "J Smith Plumbing" vs "J. Smith Plumbing Ltd" fails. For sole traders the ID name must match the contact name, which is why the onboarding form warns about it inline.
- **Registered ≠ trading address.** UK SMEs routinely register at their accountant's. Twilio wants proof of address for where they actually trade, so the form asks for the trading address.
- Proof of address should be **dated within 3 months**.
- `business_registration_identifier` for the UK is `UK:CRN`. Sole traders have no CRN — do not invent one, use Branch B.
- Mobile number must be a real reachable mobile, **not** a VoIP/CPaaS number.
- One bundle per regulation. End users and supporting documents are reusable across bundles; bundles are not.
- UK local numbers need an emergency address — we set `emergencyEnabled: true`.

## Re-verification (`valid_until`)

When the regulation behind an approved bundle changes, Twilio stamps `valid_until`
on it. **On that date the bundle flips to `twilio-rejected` and the tenant's phone
stops working.** You cannot edit an approved bundle in place, so the supported path
is the Bundle Copy dance — implemented in `twilio-revalidation.js`:

```
 callback arrives with valid_until
        │
        ▼
 1. POST /Bundles/{original}/Copies          openRevalidationCopy()
 2. attach refreshed item assignments        (sole traders: new file uploads)
 3. POST /Bundles/{copy}/Evaluations         submitRevalidationCopy()
 4. PATCH /Bundles/{copy} pending-review
        │  … Twilio reviews the COPY, fires the callback again
        ▼
 5. POST /Bundles/{original}/ReplaceItems    completeRevalidation()
        {FromBundleSid: copy}
 6. DELETE /Bundles/{copy}
```

The original never leaves `twilio-approved`, so no phone number is reassigned and
the contractor keeps service throughout. After ReplaceItems, Twilio clears
`valid_until` on the original — we re-fetch the bundle rather than assuming.

### Who has to do what

| | Limited company | Sole trader |
|---|---|---|
| Items on the copy | all attribute-only | identity + address proofs are files |
| Contractor action | **none** — copy is submitted automatically | must re-upload both documents |
| Where | n/a | `/dashboard/documents` |

### State machine

`compliance_bundles.revalidation_state` on the **primary** row:

`none` → `required` (copy opened, waiting on the contractor) → `copy-submitted`
(with Twilio) → `replaced` (done). `failed` on any error, which the daily sweep retries.

The copy gets its own row with `role='copy'` and `copy_of_bundle_sid` pointing home.
The dashboard filters to `role='primary'` so contractors never see the machinery.

### Two triggers, deliberately

1. **Status callback** — primary path, fires the moment Twilio sets `valid_until`.
2. **Daily sweep** (`sweepExpiringBundles`, backed by the `bundles_due_revalidation`
   RPC) — catches bundles whose callback was missed during a deploy, a 500, or a
   webhook URL change. Runs on an internal timer and is exposed at
   `POST /tasks/revalidate` for Railway Cron. A silently expired bundle means a
   customer's phone stops ringing, so this is worth the redundancy.

Set `REVALIDATION_SWEEP_ENABLED=false` on additional replicas so only one sweeps.

## Testing without spending money

There is no sandbox for regulatory bundles. Bundles can be created and **evaluated**
without purchasing, so in staging assert on `evaluation.status === 'compliant'` and
leave the purchase step disabled. Exercise both branches — the individual path has
far more ways to fail.

## Evaluation payload parsing & tests

`src/evaluation-parser.js` turns a `noncompliant` Evaluation into field-level
problems plus contractor-readable copy. The payload shape is:

```
results[] = {
  friendly_name, object_type, passed, failure_reason, error_code,
  valid: [], invalid: [ { friendly_name, object_field, failure_reason, error_code } ],
  requirement_friendly_name, requirement_name
}
```

Two traps worth knowing:

- The detail lives in **`invalid[]`**, not in a `fields[]` array, and individual
  fields have **no `passed` flag** — presence in `invalid` *is* the failure.
- A requirement can fail wholesale (`passed: false`) with an **empty `invalid[]`**
  when a document is absent entirely. Parsing only `invalid[]` silently loses these.
- The Node helper camelCases top-level properties but leaves nested objects in
  snake_case. The parser accepts both.

### Tests

```bash
npm test -w @sitering/telephony-worker   # 14 tests, node:test, no network
```

`test/fixtures/evaluations.js` holds the fixtures. **`noncompliantBusiness` is
copied verbatim from Twilio's API reference** so we're testing against the
documented contract, not our own assumptions. The sole-trader fixtures are
marked SYNTHETIC — they follow the same schema but have not been seen in the
wild. Replace them with a real captured payload the first time a live sole-trader
bundle is rejected, and re-run the suite: if `failedRequirements()` stops
mapping correctly, that's the signal the shape differs from what we assumed.

To capture one, log the full evaluation body in `submitUkBundle` and drop it
into the fixtures file unedited.
