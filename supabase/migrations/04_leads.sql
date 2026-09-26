-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Database Schema (Migration 04)
-- Public onboarding funnel leads (pre-signup lead intake)
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- leads — captured from the public landing funnel BEFORE an account
-- exists. One row per submission of the multi-step intake form.
-- ═════════════════════════════════════════════════════════════════
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  trade_type text,
  contact_name text,
  email text not null,
  phone_number text,
  service_requirements text[] not null default '{}',
  service_area text,
  message text,
  source text not null default 'landing_funnel',
  status text not null default 'new',
  created_at timestamptz not null default now(),

  constraint leads_status_check check (
    status in ('new', 'contacted', 'converted', 'archived')
  )
);

comment on table public.leads is 'Public landing-funnel lead intake, captured before signup.';

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

-- ═════════════════════════════════════════════════════════════════
-- Row Level Security
--   • Anyone (anon) may INSERT a lead from the public funnel.
--   • Only admins may read / manage leads.
--   • The service-role client (used by /api/leads) bypasses RLS anyway.
-- ═════════════════════════════════════════════════════════════════
alter table public.leads enable row level security;

drop policy if exists "leads_insert_public" on public.leads;
create policy "leads_insert_public"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select"
  on public.leads for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update"
  on public.leads for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
