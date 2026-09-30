-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 07)
-- Admin-controlled LiveKit voice configuration + GDPR consent trail.
--
-- 1 · voice_provider_settings — the modular speech/AI provider selection
--     edited from the Admin → Voice Studio. A single row (key 'default')
--     is read by the voice agent at session start; environment variables
--     act as the fallback so nothing breaks before an admin touches it.
--
-- 2 · voice_config_updates — audit trail of every receptionist parameter
--     captured during an admin live voice session, so changes made
--     mid-conversation are traceable after the fact.
--
-- 3 · GDPR consent columns on clients and leads — a timestamped record
--     of the exact consent given at signup, as required by UK GDPR Art. 7.
--
-- Idempotent. Safe to re-run from the build pipeline.
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- 1 · Modular voice provider settings
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.voice_provider_settings (
  key text primary key default 'default',
  tts_provider text not null default 'fishaudio',
  tts_model text not null default 'fishaudio/s2.1-pro',
  tts_voice text,
  stt_provider text not null default 'openai',
  stt_model text not null default 'gpt-4o-transcribe',
  llm_provider text not null default 'openai',
  llm_model text not null default 'gpt-4o-mini',
  fish_latency_mode text not null default 'low',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint voice_tts_provider_check check (tts_provider in ('fishaudio', 'openai')),
  constraint voice_stt_provider_check check (stt_provider in ('openai')),
  constraint voice_llm_provider_check check (llm_provider in ('openai')),
  constraint voice_latency_check check (fish_latency_mode in ('normal', 'balanced', 'low'))
);

comment on table public.voice_provider_settings is
  'Modular speech/AI provider selection for the LiveKit voice pipeline, edited from Admin → Voice Studio. Single row keyed ''default''.';

insert into public.voice_provider_settings (key)
values ('default')
on conflict (key) do nothing;

-- ═════════════════════════════════════════════════════════════════
-- 2 · Audit trail for admin voice-session parameter captures
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.voice_config_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  session_id text,
  admin_user_id uuid,
  changes jsonb not null default '{}'::jsonb,
  source text not null default 'admin_voice_session',
  created_at timestamptz not null default now(),

  constraint voice_config_source_check check (
    source in ('admin_voice_session', 'admin_manual', 'dashboard')
  )
);

create index if not exists voice_config_updates_client_idx
  on public.voice_config_updates (client_id, created_at desc);

comment on table public.voice_config_updates is
  'Every receptionist parameter change captured during an admin live voice session (or made manually from the Voice Studio), for audit and replay.';

-- ═════════════════════════════════════════════════════════════════
-- 3 · GDPR consent trail on clients
-- ═════════════════════════════════════════════════════════════════
alter table public.clients
  add column if not exists gdpr_consent boolean not null default false,
  add column if not exists gdpr_consented_at timestamptz,
  add column if not exists marketing_consent boolean not null default false;

comment on column public.clients.gdpr_consent is
  'True once the contractor ticked the GDPR consent box at signup (processing of personal data for the service).';
comment on column public.clients.gdpr_consented_at is
  'When consent was captured — UK GDPR Art. 7(1) proof of consent.';
comment on column public.clients.marketing_consent is
  'Optional consent to receive marketing. Kept separate from the service consent, which is required.';

alter table public.leads
  add column if not exists gdpr_consent boolean not null default false,
  add column if not exists gdpr_consented_at timestamptz;

comment on column public.leads.gdpr_consent is
  'True once the lead ticked the consent box on the landing funnel (ToS + Privacy + agreement to be contacted).';
comment on column public.leads.gdpr_consented_at is
  'When consent was captured — UK GDPR Art. 7(1) proof of consent.';

-- ═════════════════════════════════════════════════════════════════
-- 4 · Row Level Security — staff-only for both new tables.
--     The voice agent and route handlers use the service-role client,
--     which bypasses RLS. These policies keep the anon/user keys out.
-- ═════════════════════════════════════════════════════════════════
alter table public.voice_provider_settings enable row level security;
alter table public.voice_config_updates enable row level security;

drop policy if exists "voice_settings_admin_all" on public.voice_provider_settings;
create policy "voice_settings_admin_all"
  on public.voice_provider_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "voice_config_admin_all" on public.voice_config_updates;
create policy "voice_config_admin_all"
  on public.voice_config_updates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
