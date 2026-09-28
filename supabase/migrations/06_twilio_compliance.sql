-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 06)
-- Replace the placeholder Telnyx verification fields with real Twilio
-- Regulatory Compliance state, and record whether each contractor is a
-- sole trader or a limited company (the two follow different UK bundles).
--
-- Safe to run more than once. Every step checks the current state first,
-- so a half-applied run can simply be re-run.
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- 1 · Entity type. UK trades are mostly sole traders, so that is the
--     default; a Companies House number implies a limited company.
-- ═════════════════════════════════════════════════════════════════
alter table public.clients
  add column if not exists business_type text not null default 'sole_trader';

update public.clients
   set business_type = 'limited_company'
 where coalesce(trim(company_number), '') <> ''
   and business_type = 'sole_trader';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_business_type_check') then
    alter table public.clients
      add constraint clients_business_type_check
      check (business_type in ('sole_trader', 'limited_company'));
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════════
-- 2 · Rename the Telnyx columns rather than dropping them, so the
--     statuses already captured during onboarding survive.
-- ═════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'clients'
                and column_name = 'telnyx_verification_status') then
    alter table public.clients rename column telnyx_verification_status to twilio_bundle_status;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'clients'
                and column_name = 'telnyx_verification_notes') then
    alter table public.clients rename column telnyx_verification_notes to twilio_rejection_reason;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'clients'
                and column_name = 'telnyx_number_order_id') then
    alter table public.clients rename column telnyx_number_order_id to twilio_phone_number_sid;
  end if;
end $$;

-- The old constraint still names the old values; drop it before rewriting data.
alter table public.clients drop constraint if exists clients_telnyx_status_check;
alter table public.clients drop constraint if exists clients_twilio_bundle_status_check;

-- ═════════════════════════════════════════════════════════════════
-- 3 · Translate the existing values FIRST.
--     The previous version of this migration added the new constraint
--     before doing this, which fails on any pre-existing row.
-- ═════════════════════════════════════════════════════════════════
update public.clients set twilio_bundle_status = case twilio_bundle_status
  when 'submitted' then 'pending-review'
  when 'in_review' then 'in-review'
  when 'verified'  then 'twilio-approved'
  when 'rejected'  then 'twilio-rejected'
  else twilio_bundle_status
end;

-- Anything unrecognised (hand-edited rows, a value from a future Twilio
-- release) is parked at 'pending' rather than blocking the migration.
update public.clients
   set twilio_bundle_status = 'pending'
 where twilio_bundle_status not in (
   'pending','draft','pending-review','in-review',
   'twilio-rejected','twilio-approved','provisionally-approved');

-- Only now is it safe to enforce the new values.
-- These are Twilio's own spellings; keeping them identical avoids a
-- translation layer that would silently drift from the API.
alter table public.clients
  add constraint clients_twilio_bundle_status_check check (
    twilio_bundle_status in (
      'pending',            -- nothing submitted yet (our own pre-state)
      'draft',              -- built but failed evaluation, not sent
      'pending-review',
      'in-review',
      'twilio-rejected',
      'twilio-approved',
      'provisionally-approved'
    )
  );

-- ═════════════════════════════════════════════════════════════════
-- 4 · The SIDs we must keep to finish, re-check or renew a bundle.
-- ═════════════════════════════════════════════════════════════════
alter table public.clients
  add column if not exists twilio_bundle_sid text,
  add column if not exists twilio_end_user_sid text,
  add column if not exists twilio_address_sid text,
  add column if not exists twilio_document_sids jsonb not null default '[]'::jsonb,
  -- An approved bundle expires. Twilio flips it to twilio-rejected on the
  -- date below unless it has been re-submitted, which takes the number down
  -- with it. A scheduled job reads this column.
  add column if not exists twilio_valid_until timestamptz,
  add column if not exists twilio_submitted_at timestamptz;

create index if not exists clients_twilio_bundle_idx
  on public.clients (twilio_bundle_sid)
  where twilio_bundle_sid is not null;

create index if not exists clients_twilio_valid_until_idx
  on public.clients (twilio_valid_until)
  where twilio_valid_until is not null;

comment on column public.clients.business_type is
  'sole_trader → Twilio individual bundle (needs proof of identity + proof of address files). limited_company → business bundle (attributes only, no upload).';

comment on column public.clients.twilio_valid_until is
  'Expiry of an approved bundle. Must be renewed before this date or Twilio rejects the bundle and the number stops working.';

comment on table public.client_documents is
  'Twilio regulatory compliance documents uploaded during onboarding. Files live in the private client-documents Storage bucket.';
