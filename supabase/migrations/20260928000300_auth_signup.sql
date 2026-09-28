-- sitering-ai :: auth wiring
-- When a contractor signs up, Supabase Auth inserts into auth.users and sends the
-- confirmation email itself (Custom SMTP or a send-email auth hook -- see
-- docs/SUPABASE_AUTH.md). This trigger builds the tenant record off the back of it
-- so the dashboard has somewhere to land the user after they click the link.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_name   text := coalesce(nullif(new.raw_user_meta_data->>'business_name',''),
                            split_part(new.email, '@', 1));
  v_slug   text := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
begin
  -- unique-ify the slug
  if exists (select 1 from public.tenants where slug = v_slug) then
    v_slug := v_slug || '-' || substr(new.id::text, 1, 6);
  end if;

  insert into public.tenants (business_name, slug, contact_email, trade, status)
  values (v_name, v_slug, new.email, new.raw_user_meta_data->>'trade', 'onboarding')
  returning id into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_tenant, new.id, 'owner');

  -- seed a sensible default receptionist so the agent never has a null prompt
  insert into public.agent_configs (tenant_id, display_name, system_prompt, greeting)
  values (
    v_tenant,
    'Receptionist',
    format(
      'You are the AI receptionist for %s, a UK trade business. Be warm, brief and '
      'practical. Capture the caller''s name, contact number, postcode and a short '
      'description of the job. Confirm details back before ending. Never quote a '
      'firm price -- say a member of the team will confirm. Use British English.',
      v_name),
    format('Hello, you''ve reached %s. How can I help today?', v_name)
  );

  insert into public.provisioning_events (tenant_id, kind, payload)
  values (v_tenant, 'tenant.created', jsonb_build_object('user_id', new.id, 'email', new.email));

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mark the tenant active once the user confirms their email.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.tenants t
       set status = case when t.status = 'onboarding' then 'active' else t.status end
      from public.tenant_members m
     where m.user_id = new.id and m.tenant_id = t.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();
