-- sitering-ai :: runtime lookup used by the LiveKit worker.
-- Given the dialled UK number, return everything needed to boot the agent.
-- Called with the service role key from the Python worker.

create or replace function public.agent_config_for_number(dialled text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tenant_id',        t.id,
    'business_name',    t.business_name,
    'trade',            t.trade,
    'tenant_status',    t.status,
    'phone_number_id',  p.id,
    'e164',             p.e164,
    'agent_config_id',  c.id,
    'display_name',     c.display_name,
    'system_prompt',    c.system_prompt,
    'greeting',         c.greeting,
    'voice_id',         c.voice_id,
    'tts_model',        c.tts_model,
    'llm_model',        c.llm_model,
    'language',         c.language,
    'temperature',      c.temperature,
    'business_hours',   c.business_hours,
    'escalation_number',c.escalation_number,
    'metadata',         c.metadata
  )
  from public.phone_numbers p
  join public.tenants t on t.id = p.tenant_id
  left join public.agent_configs c
         on c.id = coalesce(p.agent_config_id,
                            (select id from public.agent_configs
                              where tenant_id = p.tenant_id and is_active
                              order by created_at limit 1))
  where p.e164 = dialled
    and p.status = 'provisioned'
  limit 1;
$$;

revoke all on function public.agent_config_for_number(text) from public, anon, authenticated;
grant execute on function public.agent_config_for_number(text) to service_role;
