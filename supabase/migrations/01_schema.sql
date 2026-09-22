-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 01)
-- Run with: supabase db push  (or paste into the Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ═════════════════════════════════════════════════════════════════
-- 1. profiles — extends Supabase Auth users (1 row per auth user)
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  owner_name text,
  phone_number text,
  trade_type text,
  emergency_forwarding_number text not null default '',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'inactive',
  created_at timestamptz not null default now(),

  constraint profiles_subscription_status_check check (
    subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  )
);

comment on table public.profiles is 'One row per SiteRing AI customer, keyed to auth.users.';
comment on column public.profiles.emergency_forwarding_number is 'Contractor mobile — emergency calls are forwarded here.';

-- ═════════════════════════════════════════════════════════════════
-- 2. telephony_provisioning — assigned UK number + usage counters
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.telephony_provisioning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  assigned_phone_number text,
  twilio_sid text,
  minutes_used_this_period integer not null default 0,
  monthly_cap_minutes integer not null default 500,
  forwarding_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint telephony_minutes_non_negative check (minutes_used_this_period >= 0),
  constraint telephony_cap_positive check (monthly_cap_minutes > 0)
);

comment on table public.telephony_provisioning is 'Per-customer telephony assignment and monthly usage. 500 minutes included.';

-- ═════════════════════════════════════════════════════════════════
-- 3. call_logs — every answered call captured by the AI receptionist
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caller_name text,
  caller_phone text,
  trade_issue_summary text,
  location_postcode text,
  urgency_level text not null default 'General Enquiry',
  full_transcript text,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now(),

  constraint call_logs_urgency_check check (
    urgency_level in ('Emergency', 'Standard Quote', 'General Enquiry')
  ),
  constraint call_logs_duration_non_negative check (duration_seconds >= 0)
);

comment on table public.call_logs is 'AI receptionist call records with transcripts.';

-- Helpful index for dashboard queries (recent calls per user)
create index if not exists call_logs_user_created_idx
  on public.call_logs (user_id, created_at desc);

-- ═════════════════════════════════════════════════════════════════
-- Row Level Security — users can ONLY touch their own records
-- ═════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.telephony_provisioning enable row level security;
alter table public.call_logs enable row level security;

-- profiles: owner-only read / insert / update (no delete — cascade via auth)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- telephony_provisioning: owner-only read/update (rows created server-side)
drop policy if exists "telephony_select_own" on public.telephony_provisioning;
create policy "telephony_select_own"
  on public.telephony_provisioning for select
  using (auth.uid() = user_id);

drop policy if exists "telephony_update_own" on public.telephony_provisioning;
create policy "telephony_update_own"
  on public.telephony_provisioning for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- call_logs: owner-only read (writes happen via service-role webhook)
drop policy if exists "call_logs_select_own" on public.call_logs;
create policy "call_logs_select_own"
  on public.call_logs for select
  using (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════
-- Auto-provisioning — new signup gets a profile + telephony row
-- ═════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name, owner_name, phone_number, trade_type, emergency_forwarding_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'My Business'),
    new.raw_user_meta_data ->> 'owner_name',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'trade_type',
    coalesce(new.raw_user_meta_data ->> 'emergency_forwarding_number', '')
  )
  on conflict (id) do nothing;

  insert into public.telephony_provisioning (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═════════════════════════════════════════════════════════════════
-- Usage helper — atomically increment minutes (called by webhook)
-- ═════════════════════════════════════════════════════════════════
create or replace function public.increment_minutes(p_user_id uuid, p_minutes integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_total integer;
begin
  update public.telephony_provisioning
  set minutes_used_this_period = minutes_used_this_period + greatest(p_minutes, 0)
  where user_id = p_user_id
  returning minutes_used_this_period into v_new_total;

  return coalesce(v_new_total, 0);
end;
$$;
