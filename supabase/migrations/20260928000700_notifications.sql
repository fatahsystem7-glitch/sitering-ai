-- sitering-ai :: transactional notification log
--
-- Doubles as the idempotency mechanism for outbound email. The daily
-- revalidation sweep re-evaluates the same bundles every night; the unique
-- index below is what stops a contractor getting the same "renew your
-- documents" email thirty times.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  kind        text not null
              check (kind in ('renewal_opened','documents_rejected','number_live',
                              'renewal_completed','provisioning_failed')),
  dedupe_key  text not null,
  recipient   text not null,
  subject     text,
  status      text not null default 'pending'
              check (status in ('pending','sent','skipped','failed')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- One message per tenant per logical event. The mailer inserts first and treats
-- a 23505 unique violation as "already sent".
create unique index if not exists notifications_dedupe_idx
  on public.notifications(tenant_id, dedupe_key);

create index if not exists notifications_tenant_idx
  on public.notifications(tenant_id, created_at desc);

alter table public.notifications enable row level security;

-- Written exclusively by the service role; tenants may read their own history.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated using (public.member_of(tenant_id));
