-- SiteRing AI · business profile used by the voice agent.
-- Idempotent. Safe to re-run from the build pipeline.

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  phone_number text,
  business_name text,
  trade_type text,
  service_areas text,
  callout_fee text,
  booking_url text,
  website_url text,
  custom_instructions text,
  services jsonb not null default '[{"name": "General Call-out", "price": "£80", "duration": "45 mins"}]'::jsonb,
  used_minutes integer not null default 0
);

alter table public.business_profiles
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists phone_number text,
  add column if not exists business_name text,
  add column if not exists trade_type text,
  add column if not exists service_areas text,
  add column if not exists callout_fee text,
  add column if not exists booking_url text,
  add column if not exists website_url text,
  add column if not exists custom_instructions text,
  add column if not exists services jsonb not null default '[{"name": "General Call-out", "price": "£80", "duration": "45 mins"}]'::jsonb,
  add column if not exists used_minutes integer not null default 0,
  add column if not exists operating_hours text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists business_profiles_user_id_uidx
  on public.business_profiles (user_id);

create unique index if not exists business_profiles_phone_number_uidx
  on public.business_profiles (phone_number)
  where phone_number is not null;

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('demo_phone_number', '')
on conflict (key) do nothing;

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles (id) on delete cascade,
  caller_number text,
  caller_name text,
  message text,
  urgency text,
  created_at timestamptz not null default now()
);

create or replace function public.profile_by_phone(raw text)
returns setof public.business_profiles
language sql
stable
security definer
set search_path = public
as $$
  select bp.*
  from public.business_profiles bp
  left join public.telephony_provisioning tp on tp.user_id = bp.user_id
  where regexp_replace(coalesce(bp.phone_number, ''), '[^0-9]', '', 'g')
        = regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g')
     or regexp_replace(coalesce(tp.assigned_phone_number, ''), '[^0-9]', '', 'g')
        = regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g')
  limit 1;
$$;

revoke all on function public.profile_by_phone(text) from public, anon, authenticated;
grant execute on function public.profile_by_phone(text) to service_role;

alter table public.business_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.callback_requests enable row level security;

drop policy if exists business_profiles_select on public.business_profiles;
create policy business_profiles_select on public.business_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists business_profiles_insert on public.business_profiles;
create policy business_profiles_insert on public.business_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists business_profiles_update on public.business_profiles;
create policy business_profiles_update on public.business_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to anon, authenticated
  using (true);

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists callback_select on public.callback_requests;
create policy callback_select on public.callback_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.business_profiles bp
      where bp.id = callback_requests.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

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

  insert into public.business_profiles (
    user_id, business_name, trade_type, service_areas, callout_fee,
    operating_hours, booking_url, website_url, custom_instructions
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'My Business'),
    new.raw_user_meta_data ->> 'trade_type',
    new.raw_user_meta_data ->> 'service_areas',
    new.raw_user_meta_data ->> 'callout_fee',
    new.raw_user_meta_data ->> 'operating_hours',
    new.raw_user_meta_data ->> 'booking_url',
    new.raw_user_meta_data ->> 'website_url',
    new.raw_user_meta_data ->> 'custom_instructions'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.business_profiles (user_id, business_name, trade_type, phone_number)
select p.id, p.business_name, p.trade_type, tp.assigned_phone_number
from public.profiles p
left join public.telephony_provisioning tp on tp.user_id = p.id
on conflict (user_id) do nothing;
