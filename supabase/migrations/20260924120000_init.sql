-- SiteRing AI schema. Idempotent: safe to re-run from the build pipeline.

create extension if not exists pgcrypto;

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'contractor',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text not null default 'contractor',
  add column if not exists created_at timestamptz not null default now();

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
  add column if not exists minutes_period text,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists provisioning_status text,
  add column if not exists provisioning_error text,
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

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles (id) on delete set null,
  phone_number text,
  caller_number text,
  direction text not null default 'inbound',
  status text not null default 'in-progress',
  duration_seconds integer not null default 0,
  billed_minutes integer not null default 0,
  twilio_call_sid text,
  livekit_room text,
  transcript text,
  summary text,
  booking_link_sent boolean not null default false,
  minutes_applied boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.call_logs
  add column if not exists business_profile_id uuid references public.business_profiles (id) on delete set null,
  add column if not exists phone_number text,
  add column if not exists caller_number text,
  add column if not exists direction text not null default 'inbound',
  add column if not exists status text not null default 'in-progress',
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists billed_minutes integer not null default 0,
  add column if not exists twilio_call_sid text,
  add column if not exists livekit_room text,
  add column if not exists transcript text,
  add column if not exists summary text,
  add column if not exists booking_link_sent boolean not null default false,
  add column if not exists minutes_applied boolean not null default false,
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists ended_at timestamptz;

create unique index if not exists call_logs_twilio_sid_uidx
  on public.call_logs (twilio_call_sid)
  where twilio_call_sid is not null;

create index if not exists call_logs_started_at_idx
  on public.call_logs (started_at desc);

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles (id) on delete cascade,
  caller_number text,
  caller_name text,
  message text,
  urgency text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_profiles_touch on public.business_profiles;
create trigger business_profiles_touch
  before update on public.business_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'contractor')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.profile_by_phone(raw text)
returns setof public.business_profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.business_profiles
  where phone_number is not null
    and (
      regexp_replace(phone_number, '[^0-9+]', '', 'g') = regexp_replace(coalesce(raw, ''), '[^0-9+]', '', 'g')
      or regexp_replace(phone_number, '[^0-9]', '', 'g') = regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g')
    )
  limit 1;
$$;

create or replace function public.add_call_minutes(profile_id uuid, minutes integer, period text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  update public.business_profiles
  set
    used_minutes = case
      when minutes_period is distinct from period then greatest(minutes, 0)
      else used_minutes + greatest(minutes, 0)
    end,
    minutes_period = period,
    updated_at = now()
  where id = profile_id
  returning used_minutes into new_total;
  return coalesce(new_total, 0);
end;
$$;

revoke all on function public.profile_by_phone(text) from public, anon, authenticated;
revoke all on function public.add_call_minutes(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.profile_by_phone(text) to service_role;
grant execute on function public.add_call_minutes(uuid, integer, text) to service_role;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.call_logs enable row level security;
alter table public.callback_requests enable row level security;
alter table public.schema_migrations enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

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

drop policy if exists business_profiles_delete on public.business_profiles;
create policy business_profiles_delete on public.business_profiles
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to anon, authenticated
  using (true);

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists call_logs_select on public.call_logs;
create policy call_logs_select on public.call_logs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.business_profiles bp
      where bp.id = call_logs.business_profile_id and bp.user_id = auth.uid()
    )
  );

drop policy if exists callback_select on public.callback_requests;
create policy callback_select on public.callback_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.business_profiles bp
      where bp.id = callback_requests.business_profile_id and bp.user_id = auth.uid()
    )
  );
