-- ─────────────────────────────────────────────────────────────────
-- SiteRing AI · Migration 02 — Admin access + call enrichment
-- Run AFTER 01_schema.sql (paste into the Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- 1. Admin flags on profiles
-- ═════════════════════════════════════════════════════════════════
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  add column if not exists role text not null default 'customer';

comment on column public.profiles.is_admin is 'True for SiteRing staff — grants full read/write via RLS admin policies.';
comment on column public.profiles.role is "'admin' for staff, 'customer' for subscribers.";

-- ═════════════════════════════════════════════════════════════════
-- 2. Call enrichment columns (AI summary + call recording)
-- ═════════════════════════════════════════════════════════════════
alter table public.call_logs
  add column if not exists ai_summary text;

alter table public.call_logs
  add column if not exists recording_url text;

comment on column public.call_logs.ai_summary is 'Short AI-generated summary of the call (set by voice agent webhook when available).';
comment on column public.call_logs.recording_url is 'Signed URL to the call audio recording (set by voice agent webhook when available).';

-- ═════════════════════════════════════════════════════════════════
-- 3. Admin helper — true when the signed-in user is staff
-- ═════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (is_admin is true or role = 'admin')
  );
$$;

-- Admins can read/write EVERYTHING (in addition to owner-only policies)
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "telephony_admin_all" on public.telephony_provisioning;
create policy "telephony_admin_all"
  on public.telephony_provisioning for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "call_logs_admin_all" on public.call_logs;
create policy "call_logs_admin_all"
  on public.call_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ═════════════════════════════════════════════════════════════════
-- 4. Auto-flag the bootstrap admin account on signup
--    abdelfatah maghraoui · d79a90f4-e324-40fc-b942-3d71246c4f74
-- ═════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_bootstrap_admin boolean := (new.id = 'd79a90f4-e324-40fc-b942-3d71246c4f74');
begin
  insert into public.profiles (
    id, business_name, owner_name, phone_number, trade_type,
    emergency_forwarding_number, is_admin, role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'My Business'),
    new.raw_user_meta_data ->> 'owner_name',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'trade_type',
    coalesce(new.raw_user_meta_data ->> 'emergency_forwarding_number', ''),
    v_is_bootstrap_admin,
    case when v_is_bootstrap_admin then 'admin' else 'customer' end
  )
  on conflict (id) do nothing;

  insert into public.telephony_provisioning (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- If the admin account already signed up before this migration, flag it now.
update public.profiles
set is_admin = true,
    role = 'admin'
where id = 'd79a90f4-e324-40fc-b942-3d71246c4f74';
