-- sitering-ai :: bundle re-verification + document re-upload
--
-- Twilio sets `valid_until` on a twilio-approved bundle when a regulation changes.
-- The bundle flips to twilio-rejected on that date unless the compliance info is
-- refreshed first -- which would take the tenant's phone number down. The fix is
-- the Bundle Copy dance:
--   copy -> update items -> evaluate -> submit -> (approved) -> ReplaceItems into
--   the original -> delete the copy. The original never leaves approved state, so
--   no phone number is ever reassigned.

-- ------------------------------------------------- bundle copy bookkeeping
alter table public.compliance_bundles
  add column if not exists role text not null default 'primary'
    check (role in ('primary','copy')),
  add column if not exists copy_of_bundle_sid text,
  add column if not exists revalidation_state text not null default 'none'
    check (revalidation_state in ('none','required','copy-open','copy-submitted','replaced','failed')),
  add column if not exists revalidation_started_at timestamptz,
  add column if not exists revalidation_error text;

create index if not exists compliance_bundles_valid_until_idx
  on public.compliance_bundles(valid_until)
  where valid_until is not null;

create index if not exists compliance_bundles_copy_idx
  on public.compliance_bundles(copy_of_bundle_sid)
  where copy_of_bundle_sid is not null;

-- ------------------------------------------------- document versioning
-- A re-upload supersedes the old file rather than deleting it, so we keep an
-- audit trail of what was sent to Twilio and when.
alter table public.compliance_documents
  add column if not exists supersedes_id uuid references public.compliance_documents(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists submitted_bundle_sid text;

-- widen the status vocabulary for the re-upload flow
alter table public.compliance_documents drop constraint if exists compliance_documents_upload_status_check;
alter table public.compliance_documents add constraint compliance_documents_upload_status_check
  check (upload_status in ('stored','uploaded','rejected','expiring','archived'));

create index if not exists compliance_documents_active_idx
  on public.compliance_documents(tenant_id, requirement)
  where archived_at is null;

-- Tenants may archive their own superseded documents (soft delete).
drop policy if exists compliance_documents_update on public.compliance_documents;
create policy compliance_documents_update on public.compliance_documents
  for update to authenticated
  using (public.member_of(tenant_id))
  with check (public.member_of(tenant_id));

-- ------------------------------------------- dashboard compliance summary
-- One call powers the whole documents view: what's on file, what Twilio said,
-- and whether the tenant needs to act right now.
create or replace function public.compliance_overview(t uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select * from compliance_bundles
     where tenant_id = t and role = 'primary'
     order by created_at desc limit 1
  ),
  docs as (
    select jsonb_agg(jsonb_build_object(
             'id', d.id,
             'requirement', d.requirement,
             'twilio_type', d.twilio_type,
             'file_name', d.file_name,
             'upload_status', d.upload_status,
             'rejection_note', d.rejection_note,
             'created_at', d.created_at
           ) order by d.created_at desc) as items
      from compliance_documents d
     where d.tenant_id = t and d.archived_at is null
  )
  select jsonb_build_object(
    'entity_type',        tn.entity_type,
    'tenant_status',      tn.status,
    'bundle_sid',         (select bundle_sid from b),
    'bundle_status',      (select status from b),
    'failure_reason',     (select failure_reason from b),
    'valid_until',        (select valid_until from b),
    'revalidation_state', coalesce((select revalidation_state from b), 'none'),
    'revalidation_error', (select revalidation_error from b),
    'documents',          coalesce((select items from docs), '[]'::jsonb),
    -- true when the contractor must upload something before we can resubmit
    'action_required',    (
       tn.entity_type = 'sole_trader' and (
         (select status from b) = 'twilio-rejected'
         or coalesce((select revalidation_state from b), 'none') = 'required'
       )
    )
  )
  from tenants tn
  where tn.id = t;
$$;

grant execute on function public.compliance_overview(uuid) to authenticated, service_role;

-- --------------------------------------------- bundles needing attention
-- Used by the telephony worker's nightly sweep as a backstop, in case a
-- status callback is missed or never fires.
create or replace function public.bundles_due_revalidation(window_days int default 30)
returns setof public.compliance_bundles
language sql
stable
security definer
set search_path = public
as $$
  select *
    from compliance_bundles
   where role = 'primary'
     and valid_until is not null
     and valid_until < now() + make_interval(days => window_days)
     and revalidation_state in ('none','required','failed')
     and status in ('twilio-approved','provisionally-approved')
   order by valid_until;
$$;

revoke all on function public.bundles_due_revalidation(int) from public, anon, authenticated;
grant execute on function public.bundles_due_revalidation(int) to service_role;
