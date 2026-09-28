-- sitering-ai :: Row-Level Security
-- Rule: anon/authenticated clients only ever see their own tenant's rows.
-- The service role key (used by the agent worker + telephony worker) bypasses RLS.

alter table public.tenants             enable row level security;
alter table public.tenant_members      enable row level security;
alter table public.platform_admins     enable row level security;
alter table public.agent_configs       enable row level security;
alter table public.phone_numbers       enable row level security;
alter table public.compliance_bundles  enable row level security;
alter table public.calls               enable row level security;
alter table public.provisioning_events enable row level security;

-- helpers ------------------------------------------------------------------
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.member_of(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = t and user_id = auth.uid()
  ) or public.is_platform_admin();
$$;

-- tenants ------------------------------------------------------------------
drop policy if exists tenants_read on public.tenants;
create policy tenants_read on public.tenants
  for select to authenticated using (public.member_of(id));

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated using (public.member_of(id)) with check (public.member_of(id));

-- membership ---------------------------------------------------------------
drop policy if exists members_read on public.tenant_members;
create policy members_read on public.tenant_members
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

-- platform admins ----------------------------------------------------------
drop policy if exists admins_read on public.platform_admins;
create policy admins_read on public.platform_admins
  for select to authenticated using (public.is_platform_admin());

-- tenant-scoped tables -----------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['agent_configs','phone_numbers','compliance_bundles',
                             'calls','provisioning_events'] loop
    execute format('drop policy if exists %1$s_rw on public.%1$s;', tbl);
    execute format($p$
      create policy %1$s_rw on public.%1$s
        for all to authenticated
        using (public.member_of(tenant_id))
        with check (public.member_of(tenant_id));
    $p$, tbl);
  end loop;
end $$;

-- compliance + provisioning events are written by the service role only;
-- tighten them to read-only for tenant users.
drop policy if exists compliance_bundles_rw on public.compliance_bundles;
create policy compliance_bundles_read on public.compliance_bundles
  for select to authenticated using (public.member_of(tenant_id));

drop policy if exists provisioning_events_rw on public.provisioning_events;
create policy provisioning_events_read on public.provisioning_events
  for select to authenticated using (public.member_of(tenant_id));
