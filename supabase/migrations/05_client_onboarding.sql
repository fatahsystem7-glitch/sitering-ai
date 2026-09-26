-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 05)
-- Public onboarding (account creation + Telnyx KYC documents)
-- and the single unified client dashboard (login by Client ID).
-- ─────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ═════════════════════════════════════════════════════════════════
-- clients — ONE row per trade contractor account created through the
-- public onboarding form. `id` IS the Client ID (UUID) the contractor
-- uses to log into /dashboard.
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),

  -- Step 1 · Business
  business_name text not null,
  trade_type text,
  company_number text,
  vat_number text,

  -- Step 2 · Contact / account owner
  owner_name text not null,
  email text not null,
  phone_number text,
  emergency_forwarding_number text not null default '',

  -- Step 3 · Address (must match proof of address for Telnyx)
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text not null default 'GB',

  -- Step 4 · AI receptionist profile
  service_areas text,
  services_offered text[] not null default '{}',
  operating_hours text,
  callout_fee text,
  greeting_style text,
  custom_instructions text,

  -- Step 5 · Telnyx verification (KYC documents live in Storage)
  id_document_type text,
  id_document_path text,
  proof_of_address_path text,
  telnyx_verification_status text not null default 'pending',
  telnyx_verification_notes text,
  telnyx_number_order_id text,

  -- Assigned telephony + commercials
  assigned_phone_number text,
  minutes_used_this_period integer not null default 0,
  monthly_cap_minutes integer not null default 500,
  subscription_status text not null default 'inactive',
  onboarding_status text not null default 'submitted',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clients_telnyx_status_check check (
    telnyx_verification_status in ('pending', 'submitted', 'in_review', 'verified', 'rejected')
  ),
  constraint clients_onboarding_status_check check (
    onboarding_status in ('submitted', 'documents_received', 'provisioning', 'live', 'paused')
  ),
  constraint clients_subscription_status_check check (
    subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  constraint clients_minutes_non_negative check (minutes_used_this_period >= 0),
  constraint clients_cap_positive check (monthly_cap_minutes > 0)
);

comment on table public.clients is
  'Trade contractor accounts created via the public onboarding form. clients.id is the Client ID used to log into /dashboard.';
comment on column public.clients.id is 'Client ID (UUID) — the dashboard login credential.';
comment on column public.clients.id_document_path is 'Storage path in the private client-documents bucket (passport / driving licence).';
comment on column public.clients.proof_of_address_path is 'Storage path in the private client-documents bucket (utility bill / bank statement).';

create unique index if not exists clients_email_unique_idx on public.clients (lower(email));
create index if not exists clients_created_idx on public.clients (created_at desc);
create index if not exists clients_status_idx on public.clients (onboarding_status);

-- Keep updated_at fresh
create or replace function public.touch_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.touch_clients_updated_at();

-- ═════════════════════════════════════════════════════════════════
-- client_documents — audit trail of every uploaded KYC document
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),

  constraint client_documents_kind_check check (
    kind in ('id_document', 'proof_of_address', 'other')
  )
);

create index if not exists client_documents_client_idx
  on public.client_documents (client_id, created_at desc);

comment on table public.client_documents is
  'Telnyx verification documents uploaded during onboarding. Files live in the private client-documents Storage bucket.';

-- ═════════════════════════════════════════════════════════════════
-- call_logs / message_logs keyed to the Client ID
-- ═════════════════════════════════════════════════════════════════
alter table public.call_logs
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table public.call_logs
  alter column user_id drop not null;

create index if not exists call_logs_client_created_idx
  on public.call_logs (client_id, created_at desc);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  direction text not null default 'inbound',
  channel text not null default 'sms',
  contact_name text,
  contact_phone text,
  body text,
  transcript text,
  summary text,
  urgency_level text not null default 'General Enquiry',
  created_at timestamptz not null default now(),

  constraint message_logs_direction_check check (direction in ('inbound', 'outbound')),
  constraint message_logs_channel_check check (channel in ('sms', 'whatsapp', 'voicemail', 'web')),
  constraint message_logs_urgency_check check (
    urgency_level in ('Emergency', 'Standard Quote', 'General Enquiry')
  )
);

create index if not exists message_logs_client_created_idx
  on public.message_logs (client_id, created_at desc);

comment on table public.message_logs is 'SMS / WhatsApp / voicemail message transcripts shown in the unified client dashboard.';

-- ═════════════════════════════════════════════════════════════════
-- Row Level Security
--   Everything here is read/written by the Next.js server using the
--   service-role key (which bypasses RLS) after verifying the signed
--   Client-ID session cookie. Anonymous clients get NO direct access.
-- ═════════════════════════════════════════════════════════════════
alter table public.clients enable row level security;
alter table public.client_documents enable row level security;
alter table public.message_logs enable row level security;

drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all"
  on public.clients for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "client_documents_admin_all" on public.client_documents;
create policy "client_documents_admin_all"
  on public.client_documents for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "message_logs_admin_all" on public.message_logs;
create policy "message_logs_admin_all"
  on public.message_logs for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ═════════════════════════════════════════════════════════════════
-- Private Storage bucket for KYC documents
-- ═════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only admins (and the service role, which bypasses RLS) may read documents.
drop policy if exists "client_documents_admin_read" on storage.objects;
create policy "client_documents_admin_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ═════════════════════════════════════════════════════════════════
-- Usage helper for the Client-ID model
-- ═════════════════════════════════════════════════════════════════
create or replace function public.increment_client_minutes(p_client_id uuid, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_total integer;
begin
  update public.clients
  set minutes_used_this_period = minutes_used_this_period + greatest(p_minutes, 0)
  where id = p_client_id
  returning minutes_used_this_period into v_new_total;

  return coalesce(v_new_total, 0);
end;
$$;
