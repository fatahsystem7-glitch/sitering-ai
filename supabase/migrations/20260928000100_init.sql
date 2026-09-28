-- sitering-ai :: core multi-tenant schema
-- Tenant = one UK trade contractor business.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tenants
create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  business_name     text not null,
  trade             text,                       -- plumber, electrician, roofer...
  contact_email     text not null,
  contact_phone     text,
  status            text not null default 'onboarding'
                    check (status in ('onboarding','active','suspended','churned')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- membership: which auth users can see which tenant
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- staff of sitering-ai itself (can see everything)
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- receptionist config
create table if not exists public.agent_configs (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  display_name       text not null default 'Receptionist',
  system_prompt      text not null,
  greeting           text not null default 'Hello, thanks for calling. How can I help?',
  voice_id           text not null default '933563129e564b19a115bedd57b7406a',
  tts_model          text not null default 's2.1-pro',
  llm_model          text not null default 'gpt-4.1-mini',
  language           text not null default 'en-GB',
  temperature        numeric not null default 0.5,
  business_hours     jsonb not null default '{}'::jsonb,
  escalation_number  text,                    -- E.164, transfer target
  metadata           jsonb not null default '{}'::jsonb,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists agent_configs_tenant_idx on public.agent_configs(tenant_id);

-- ------------------------------------------------------------- phone numbers
create table if not exists public.phone_numbers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  agent_config_id     uuid references public.agent_configs(id) on delete set null,
  e164                text unique not null,     -- +44...
  twilio_sid          text unique,
  iso_country         text not null default 'GB',
  number_type         text not null default 'local',
  status              text not null default 'pending'
                      check (status in ('pending','provisioned','released','failed')),
  provisioned_at      timestamptz,
  created_at          timestamptz not null default now()
);
create unique index if not exists phone_numbers_e164_idx on public.phone_numbers(e164);

-- -------------------------------------------------------- compliance bundles
create table if not exists public.compliance_bundles (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  bundle_sid           text unique,
  end_user_sid         text,
  address_sid          text,
  supporting_doc_sids  text[] not null default '{}',
  regulation_sid       text,
  iso_country          text not null default 'GB',
  number_type          text not null default 'local',
  end_user_type        text not null default 'business'
                       check (end_user_type in ('business','individual')),
  status               text not null default 'draft'
                       check (status in ('draft','pending-review','in-review',
                                         'twilio-rejected','twilio-approved',
                                         'provisionally-approved')),
  failure_reason       text,
  valid_until          timestamptz,
  last_callback_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists compliance_bundles_tenant_idx on public.compliance_bundles(tenant_id);

-- --------------------------------------------------------------- call record
create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete set null,
  phone_number_id uuid references public.phone_numbers(id) on delete set null,
  room_name       text,
  call_sid        text,
  from_e164       text,
  to_e164         text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_secs   integer,
  transcript      jsonb not null default '[]'::jsonb,
  summary         text,
  outcome         text,     -- booking, quote_request, message, spam...
  created_at      timestamptz not null default now()
);
create index if not exists calls_tenant_started_idx on public.calls(tenant_id, started_at desc);

-- ------------------------------------------------------- provisioning audit
create table if not exists public.provisioning_events (
  id          bigserial primary key,
  tenant_id   uuid references public.tenants(id) on delete cascade,
  kind        text not null,          -- bundle.created, bundle.status, number.purchased...
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['tenants','agent_configs','compliance_bundles'] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;
       create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;
