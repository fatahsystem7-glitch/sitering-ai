-- sitering-ai :: sole-trader (individual) compliance support
-- UK trades are majority sole traders. Twilio treats them as end_user_type=individual,
-- which -- unlike the business path -- requires real uploaded documents:
--   Proof of Identity : passport | government_issued_document
--   Proof of Address  : utility_bill | tax_notice | rent_receipt | title_deed
--                       | government_issued_document (showing the UK address)
-- So we need somewhere to hold those files before they go to Twilio.

-- ------------------------------------------------- tenant entity/KYC details
alter table public.tenants
  add column if not exists entity_type text not null default 'limited_company'
    check (entity_type in ('sole_trader','limited_company')),
  add column if not exists legal_name text,
  add column if not exists registration_number text,        -- CRN, limited companies only
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name text,
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_region text,
  add column if not exists address_postcode text,
  add column if not exists is_isv boolean not null default false;

-- Limited companies must carry a CRN; sole traders must not be asked for one.
alter table public.tenants drop constraint if exists tenants_entity_requirements;
alter table public.tenants add constraint tenants_entity_requirements check (
  entity_type <> 'limited_company'
  or status = 'onboarding'
  or registration_number is not null
);

-- ------------------------------------------------------ compliance documents
create table if not exists public.compliance_documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  -- what regulatory requirement this file satisfies
  requirement    text not null
                 check (requirement in ('proof_of_identity','proof_of_address')),
  -- the Twilio SupportingDocument type we will submit it as
  twilio_type    text not null
                 check (twilio_type in ('passport','government_issued_document',
                                        'utility_bill','tax_notice','rent_receipt',
                                        'title_deed','individual_address','business_address')),
  storage_path   text not null,          -- path within the 'compliance-docs' bucket
  file_name      text,
  mime_type      text,
  size_bytes     integer,
  document_sid   text,                   -- RD… once uploaded to Twilio
  upload_status  text not null default 'stored'
                 check (upload_status in ('stored','uploaded','rejected')),
  rejection_note text,
  created_at     timestamptz not null default now()
);
create index if not exists compliance_documents_tenant_idx
  on public.compliance_documents(tenant_id, requirement);

alter table public.compliance_documents enable row level security;

-- Tenants may upload and read their own documents; only the service role updates
-- document_sid / upload_status.
drop policy if exists compliance_documents_select on public.compliance_documents;
create policy compliance_documents_select on public.compliance_documents
  for select to authenticated using (public.member_of(tenant_id));

drop policy if exists compliance_documents_insert on public.compliance_documents;
create policy compliance_documents_insert on public.compliance_documents
  for insert to authenticated with check (public.member_of(tenant_id));

drop policy if exists compliance_documents_delete on public.compliance_documents;
create policy compliance_documents_delete on public.compliance_documents
  for delete to authenticated
  using (public.member_of(tenant_id) and upload_status = 'stored');

-- ------------------------------------------------------------ private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compliance-docs', 'compliance-docs', false, 10485760,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at compliance-docs/<tenant_id>/<uuid>.<ext>; the first path segment
-- is the tenant id, so membership on that folder is the whole access rule.
drop policy if exists compliance_docs_read on storage.objects;
create policy compliance_docs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'compliance-docs'
    and public.member_of(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists compliance_docs_write on storage.objects;
create policy compliance_docs_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'compliance-docs'
    and public.member_of(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists compliance_docs_delete on storage.objects;
create policy compliance_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'compliance-docs'
    and public.member_of(((storage.foldername(name))[1])::uuid)
  );

-- --------------------------------------------- onboarding readiness helper
-- Drives the dashboard checklist and gates the provisioning call.
create or replace function public.onboarding_status(t uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tenant_id',        tn.id,
    'entity_type',      tn.entity_type,
    'has_details',      (tn.legal_name is not null
                         and tn.address_street is not null
                         and tn.address_postcode is not null
                         and tn.contact_first_name is not null),
    'has_registration', (tn.entity_type <> 'limited_company'
                         or tn.registration_number is not null),
    'has_identity_doc', (tn.entity_type <> 'sole_trader' or exists (
                          select 1 from compliance_documents d
                          where d.tenant_id = tn.id and d.requirement = 'proof_of_identity')),
    'has_address_doc',  (tn.entity_type <> 'sole_trader' or exists (
                          select 1 from compliance_documents d
                          where d.tenant_id = tn.id and d.requirement = 'proof_of_address')),
    'bundle_status',    (select b.status from compliance_bundles b
                          where b.tenant_id = tn.id
                          order by b.created_at desc limit 1),
    'phone_number',     (select p.e164 from phone_numbers p
                          where p.tenant_id = tn.id and p.status = 'provisioned'
                          order by p.created_at limit 1)
  )
  from tenants tn
  where tn.id = t;
$$;

grant execute on function public.onboarding_status(uuid) to authenticated, service_role;
